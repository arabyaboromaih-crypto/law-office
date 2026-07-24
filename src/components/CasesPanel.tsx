/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Case, Client, CaseType, LitigationDegree, User, CaseFile, Company, CompanyPartner, CompanyDoc, HearingSession, LegalTask, CaseClient, Opponent } from '../types';
import { 
  Search, Plus, Gavel, FileText, UserCheck, Calendar, Archive, Eye, Printer, Download,
  Trash2, PlusCircle, Paperclip, CheckCircle, HelpCircle, X, ShieldAlert, Coins, Scale,
  Building2, Phone, Mail, MapPin, UserPlus, Users, FileUp, AlertTriangle, MessageSquare, Upload, RefreshCw,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  ArrowRight, Globe, FolderOpen, Briefcase, Link
} from 'lucide-react';
import { 
  BaseModal, FormCard, SectionHeader, FormGrid, FormField, 
  PrimaryButton, SecondaryButton, DangerButton 
} from './FormComponents';
import { suggestHearingSession, checkIfRelatesToHearing, extractHearingDate } from '../utils/hearingSync';
import { saveFileToIndexedDB, getFileFromIndexedDB, getProxiedUrl, uploadToR2 } from '../utils/fileStorage';
import MultiUploadManager from './MultiUploadManager';
import { toAr } from '../utils/arabicNumbers';
import { CourtSelect } from '../utils/courts';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from "firebase/storage";
import { storage } from "../services/firebase";
import SmartCaseFile from './SmartCaseFile';
import { validateNationalId } from '../utils/validation';

/**
 * Uploads a file securely and reliably to Cloudflare R2 using a presigned URL.
 * This ensures files are permanently stored in the cloud, bypassing serverless payload limits.
 */
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

      // Call onSaveToFirestore directly with the cloud URL so it gets saved to Firestore
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

interface CasesPanelProps {
  cases: Case[];
  clients: Client[];
  companies: Company[];
  users: User[];
  currentUser: User;
  onAddCase: (c: Case) => void;
  onUpdateCase: (c: Case) => void;
  onArchiveCase: (caseId: string, reason: string, notes: string) => void;
  onDeleteCase: (caseId: string, reason: string, passwordConfirm: string) => boolean;
  onAddCompany: (co: Company) => void;
  onUpdateCompany: (co: Company) => void;
  onArchiveCompany: (coId: string, reason: string, notes: string) => void;
  onDeleteCompany: (companyId: string) => void;
  onAddClient?: (c: Client) => void;
  onUpdateClient?: (c: Client) => void;
  onAddAuditLog?: (user: User, action: 'add' | 'edit' | 'delete' | 'archive', details: string) => void;
  onAddTask?: (task: LegalTask) => void;
  sessions?: HearingSession[];
  onAddSession?: (session: HearingSession) => void;
  onUpdateSession?: (session: HearingSession) => void;
  tasks?: LegalTask[];
  onNavigateToTab?: (tab: string) => void;
  externalSearchQuery?: string;
  onClearExternalSearch?: () => void;
  returnToClient?: { id: string; name: string } | null;
  onSetReturnToClient?: (ret: { id: string; name: string } | null) => void;
  onSetSelectedClientIdForReturn?: (id: string | null) => void;
}

// Cache the PDF worker blob URL globally to bypass iframe CORS/sandboxing in popup windows
let cachedPdfWorkerBlobUrl = '';

const getPdfWorkerBlobUrl = async (): Promise<string> => {
  if (cachedPdfWorkerBlobUrl) return cachedPdfWorkerBlobUrl;
  const urls = [
    '/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
    'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js'
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        const blob = new Blob([text], { type: 'application/javascript' });
        cachedPdfWorkerBlobUrl = URL.createObjectURL(blob);
        return cachedPdfWorkerBlobUrl;
      }
    } catch (e) {
      console.warn(`Failed to fetch PDF worker from ${url}, trying next:`, e);
    }
  }
  return '/pdf.worker.min.js';
};

const capacityOptions = [
  'مدعي',
  'مدعى عليه',
  'مستأنف',
  'مستأنف ضده',
  'منفذ',
  'منفذ ضده',
  'شاكي',
  'مشكو في حقه',
  'متهم',
  'مجني عليه'
];

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "اختر...",
  required = false
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full text-right" dir="rtl">
      <div 
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={`w-full px-3 py-2 bg-slate-50 border ${required && !value ? 'border-red-300' : 'border-slate-200'} rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-between hover:bg-white hover:border-amber-400 transition-all duration-200 h-[38px]`}
      >
        <span className={value ? 'text-slate-850 font-black' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن الصفة..."
              className="w-full bg-transparent text-xs text-slate-800 focus:outline-none py-0.5"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {search && (
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  setSearch('');
                }}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-bold px-1"
              >
                مسح
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-3.5 text-center text-slate-400 text-[11px] font-medium">
                لا توجد نتائج مطابقة
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    value === opt 
                      ? 'bg-amber-500/10 text-amber-700 font-extrabold' 
                      : 'text-slate-705 hover:bg-slate-50'
                  }`}
                >
                  <span>{opt}</span>
                  {value === opt && <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CasesPanel({ 
  cases, clients, companies, users, currentUser, onAddCase, onUpdateCase, onArchiveCase, onDeleteCase,
  onAddCompany, onUpdateCompany, onArchiveCompany, onDeleteCompany,
  onAddClient, onUpdateClient, onAddAuditLog, onAddTask,
  sessions = [], onAddSession, onUpdateSession, tasks = [], onNavigateToTab,
  externalSearchQuery, onClearExternalSearch,
  returnToClient, onSetReturnToClient, onSetSelectedClientIdForReturn
}: CasesPanelProps) {
  
  // Tab within panel: Cases vs Companies
  const [activeSubTab, setActiveSubTab] = useState<'cases' | 'companies'>('cases');

  // States
  const [searchQuery, setSearchQuery] = useState('');

  // States for recording/editing court decisions within CasesPanel
  const [decisionSession, setDecisionSession] = useState<HearingSession | null>(null);
  const [decisionText, setDecisionText] = useState('');
  const [decisionNextHearingDate, setDecisionNextHearingDate] = useState('');
  const [decisionNextHearingTime, setDecisionNextHearingTime] = useState('09:00');
  const [rollPhotoUrl, setRollPhotoUrl] = useState('');


  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('الكل');
  const [selectedDegreeFilter, setSelectedDegreeFilter] = useState<string>('الكل');
  const [selectedCourtFilter, setSelectedCourtFilter] = useState<string>('الكل');

  // Company management states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [activeCompanyFormTab, setActiveCompanyFormTab] = useState<'primary' | 'partners' | 'documents' | 'tasks' | 'clients'>('primary');
  const [companyStageTab, setCompanyStageTab] = useState<'establishment' | 'post-establishment'>('establishment');
  const [selectedClientToLink, setSelectedClientToLink] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  // Quick Client creation states
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientNationalId, setNewClientNationalId] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientJob, setNewClientJob] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // Quick Task creation states
  const [companyTaskTitle, setCompanyTaskTitle] = useState('');
  const [companyTaskDesc, setCompanyTaskDesc] = useState('');
  const [companyTaskDueDate, setCompanyTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [companyTaskAssignedTo, setCompanyTaskAssignedTo] = useState('');
  const [companyTaskPriority, setCompanyTaskPriority] = useState<'عاجلة' | 'عالية' | 'متوسطة' | 'منخفضة'>('متوسطة');

  // Archive Company Modal
  const [archiveCoTarget, setArchiveCoTarget] = useState<Company | null>(null);
  const [archiveCoReason, setArchiveCoReason] = useState('انتهاء التعاقد مع المكتب');
  const [customArchiveCoReason, setCustomArchiveCoReason] = useState('');
  const [archiveCoNotes, setArchiveCoNotes] = useState('');
  const [archiveCoPassword, setArchiveCoPassword] = useState('');
  const [archiveCoError, setArchiveCoError] = useState('');

  // View Company Documents Modal
  const [viewDocsCompany, setViewDocsCompany] = useState<Company | null>(null);

  // Company form states
  const [coName, setCoName] = useState('');
  const [coType, setCoType] = useState('شركة مساهمة');
  const [coRegister, setCoRegister] = useState('');
  const [coTaxCard, setCoTaxCard] = useState('');
  const [coVat, setCoVat] = useState('');
  const [coActivity, setCoActivity] = useState('');
  const [coAddress, setCoAddress] = useState('');
  const [coPhone, setCoPhone] = useState('');
  const [coOfficeFileNumber, setCoOfficeFileNumber] = useState('');
  const [coPartners, setCoPartners] = useState<CompanyPartner[]>([]);

  // Partner Form State (Temp)
  const [partName, setPartName] = useState('');
  const [partPercentage, setPartPercentage] = useState(50);
  const [partShare, setPartShare] = useState(1000000);
  const [partId, setPartId] = useState('');
  const [partPhone, setPartPhone] = useState('');
  const [partAddress, setPartAddress] = useState('');
  const [registerPartnerAsClient, setRegisterPartnerAsClient] = useState(true);
  const [autofillClientId, setAutofillClientId] = useState('');

  // Corporate doc form state (Temp) and IDs
  const [currentCompanyId, setCurrentCompanyId] = useState<string>('');
  const [isCompanyDocUploading, setIsCompanyDocUploading] = useState<boolean>(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'pdf' | 'word' | 'image'>('pdf');
  const [companyDocsList, setCompanyDocsList] = useState<CompanyDoc[]>([]);
  const [stagedCompanyFile, setStagedCompanyFile] = useState<{
    file?: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image';
    size: string;
    originalName: string;
  } | null>(null);
  const companyFileInputRef = useRef<HTMLInputElement>(null);

  const [stagedSessionFile, setStagedSessionFile] = useState<{
    file?: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image';
    size: string;
    originalName: string;
  } | null>(null);
  const sessionFileInputRef = useRef<HTMLInputElement>(null);

  // Delete company verification states
  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<Company | null>(null);
  const [deleteCompanyPassword, setDeleteCompanyPassword] = useState('');
  const [deleteCompanyError, setDeleteCompanyError] = useState('');

  // Edit / Add Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'judicial' | 'litigants' | 'financials' | 'attachments'>('judicial');

  // File Viewer & Print Modal
  const [showDocViewer, setShowDocViewer] = useState<Case | null>(null);
  const [docViewerTab, setDocViewerTab] = useState<'docs' | 'sessions'>('docs');
  const [showReportViewer, setShowReportViewer] = useState<Case | null>(null);

  // Inline Session Creation inside Case Viewer
  const [showAddSessionForm, setShowAddSessionForm] = useState(false);
  const [newSessDate, setNewSessDate] = useState('');
  const [newSessTime, setNewSessTime] = useState('09:00');
  const [newSessSubject, setNewSessSubject] = useState('');
  const [newSessLawyerId, setNewSessLawyerId] = useState('');

  // Handle external search query on mount or update and pre-fetch PDF worker
  React.useEffect(() => {
    getPdfWorkerBlobUrl().catch(() => {});

    if (externalSearchQuery) {
      setActiveSubTab('cases');
      
      const exactCase = cases.find(c => 
        c.id === externalSearchQuery || 
        c.caseNumberFirstInstance === externalSearchQuery
      );
      
      if (exactCase) {
        setSearchQuery(exactCase.caseNumberFirstInstance);
        setShowDocViewer(exactCase);
        setDocViewerTab('docs');
      } else {
        setSearchQuery(externalSearchQuery);
      }

      if (onClearExternalSearch) {
        onClearExternalSearch();
      }
    }
  }, [externalSearchQuery, onClearExternalSearch, cases]);

  // Archive Modal State
  const [archiveTarget, setArchiveTarget] = useState<Case | null>(null);
  const [archiveReason, setArchiveReason] = useState('صدر حكم نهائي');
  const [customArchiveReason, setCustomArchiveReason] = useState('');
  const [archiveNotes, setArchiveNotes] = useState('');
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveError, setArchiveError] = useState('');

  // Permanent Delete Modal State (Only Super Admin)
  const [deleteTarget, setDeleteTarget] = useState<Case | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Form Fields
  const [officeFileNo, setOfficeFileNo] = useState('');
  const [caseNo1st, setCaseNo1st] = useState('');
  const [caseYear1st, setCaseYear1st] = useState('2026');
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
  const [caseType, setCaseType] = useState<CaseType>('جنح');
  const [customCaseType, setCustomCaseType] = useState('');
  const [court, setCourt] = useState('');
  const [circuit, setCircuit] = useState('');
  const [nextHearing, setNextHearing] = useState('');
  const [nextHearingTime, setNextHearingTime] = useState('09:00');
  const [status, setStatus] = useState('متداولة بجلسات المحكمة');
  const [clientName, setClientName] = useState('');
  const [oppName, setOppName] = useState('');
  const [oppRole, setOppRole] = useState('مدعى عليه / خصم');
  const [oppAddress, setOppAddress] = useState('');
  const [oppLawyer, setOppLawyer] = useState('');
  const [oppPhone, setOppPhone] = useState('');
  const [oppLawyerPhone, setOppLawyerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [caseSubject, setCaseSubject] = useState('');
  const [prosecutor, setProsecutor] = useState('');
  const [enforcementNo, setEnforcementNo] = useState('');
  const [degree, setDegree] = useState<LitigationDegree>('أول درجة');
  const [totalFees, setTotalFees] = useState(15000);
  const [paidFees, setPaidFees] = useState(5000);
  const [assignedLawyer, setAssignedLawyer] = useState('');
  const [formClients, setFormClients] = useState<CaseClient[]>([]);
  const [formOpponents, setFormOpponents] = useState<Opponent[]>([]);

  // Expert Referral Form Fields
  const [isReferredToExperts, setIsReferredToExperts] = useState(false);
  const [expertReferralDate, setExpertReferralDate] = useState('');
  const [expertCourtOrCircuit, setExpertCourtOrCircuit] = useState('');
  const [expertReferralReason, setExpertReferralReason] = useState('');
  const [expertOffice, setExpertOffice] = useState('');
  const [expertFileNumber, setExpertFileNumber] = useState('');
  const [expertName, setExpertName] = useState('');
  const [expertFirstSessionDate, setExpertFirstSessionDate] = useState('');
  const [expertNotes, setExpertNotes] = useState('');

  // Case ID and file upload status
  const [currentCaseId, setCurrentCaseId] = useState<string>('');
  const [isFileUploading, setIsFileUploading] = useState<boolean>(false);

  // Document Upload simulator state
  const [uploadedFiles, setUploadedFiles] = useState<CaseFile[]>([]);
  const [stagedDeviceFile, setStagedDeviceFile] = useState<{
    file?: File;
    fileUrl: string;
    type: 'pdf' | 'word' | 'image' | 'doc';
    size: string;
    originalName: string;
  } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<string>('صحيفة دعوى');
  const [newFileType, setNewFileType] = useState<'pdf' | 'word' | 'image'>('pdf');
  const [newFileUploader, setNewFileUploader] = useState(currentUser?.fullName || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out archived ones
  const activeCases = cases.filter(c => !c.isArchived);

  // Get distinct values for filter selectors
  const allCaseTypes = Array.from(new Set(activeCases.map(c => c.type)));
  const allCourts = Array.from(new Set(activeCases.map(c => c.court)));

  // Filter Logic
  const filteredCases = activeCases.filter(c => {
    const matchesSearch = 
      c.clientName.includes(searchQuery) ||
      (c.officeFileNo && c.officeFileNo.includes(searchQuery)) ||
      c.caseNumberFirstInstance.includes(searchQuery) ||
      (c.caseNumberSecondInstance && c.caseNumberSecondInstance.includes(searchQuery)) ||
      c.court.includes(searchQuery) ||
      c.opponent.name.includes(searchQuery) ||
      c.opponent.phone.includes(searchQuery) ||
      (c.opponent.lawyer && c.opponent.lawyer.includes(searchQuery)) ||
      (c.opponent.lawyerPhone && c.opponent.lawyerPhone.includes(searchQuery)) ||
      c.type.includes(searchQuery) ||
      (c.clientsList && c.clientsList.some(cl => 
        cl.name.includes(searchQuery) || 
        (cl.phone && cl.phone.includes(searchQuery)) || 
        (cl.email && cl.email.includes(searchQuery))
      )) ||
      (c.opponentsList && c.opponentsList.some(opp => 
        opp.name.includes(searchQuery) || 
        (opp.phone && opp.phone.includes(searchQuery)) || 
        (opp.lawyer && opp.lawyer.includes(searchQuery)) || 
        (opp.lawyerPhone && opp.lawyerPhone.includes(searchQuery))
      ));

    const matchesType = selectedTypeFilter === 'الكل' || c.type === selectedTypeFilter;
    const matchesDegree = selectedDegreeFilter === 'الكل' || c.degree === selectedDegreeFilter;
    const matchesCourt = selectedCourtFilter === 'الكل' || c.court === selectedCourtFilter;

    return matchesSearch && matchesType && matchesDegree && matchesCourt;
  });

  // Filter Active Companies
  const activeCompanies = companies.filter(c => !c.isArchived);

  // Filter companies based on searchQuery
  const filteredCompanies = activeCompanies.filter(co => {
    const matchesSearch = 
      co.name.includes(searchQuery) ||
      co.commercialRegister.includes(searchQuery) ||
      co.taxCard.includes(searchQuery) ||
      co.activityType.includes(searchQuery);
    return matchesSearch;
  });

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

  // Add Partner to Company Form
  const handleAddPartner = () => {
    if (!partName) {
      alert('يرجى ملء اسم الشريك أولاً');
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

    // Integrate with clients database if selected
    if (registerPartnerAsClient) {
      const targetCompanyId = currentCompanyId || (editingCompany ? editingCompany.id : `company-${Date.now()}`);
      const existingCl = clients.find(c => (partPhone && c.phone === partPhone) || c.name === partName);
      if (existingCl) {
        if (onUpdateClient) {
          onUpdateClient({ ...existingCl, companyId: targetCompanyId });
        }
      } else {
        if (onAddClient) {
          const newCl: Client = {
            id: `client-${Date.now()}`,
            name: partName,
            phone: partPhone,
            nationalId: finalPartId || undefined,
            address: partAddress,
            job: 'شريك وممثل قانوني',
            companyId: targetCompanyId
          };
          onAddClient(newCl);
          if (onAddAuditLog) {
            onAddAuditLog(currentUser, 'add', `تأسيس شركة: تسجيل الموكل ${partName} كـ ممثل قانوني وشريك مرتبط بالشركة تلقائياً`);
          }
        }
      }
    }

    setPartName('');
    setPartId('');
    setPartPhone('');
    setPartAddress('');
    setAutofillClientId('');
  };

  // Link Partner as Client in Database
  const handleLinkPartnerAsClient = (partner: CompanyPartner) => {
    const targetCompanyId = currentCompanyId || (editingCompany ? editingCompany.id : `company-${Date.now()}`);
    const existingCl = clients.find(c => (partner.phone && c.phone === partner.phone) || c.name === partner.name);
    if (existingCl) {
      if (onUpdateClient) {
        onUpdateClient({ ...existingCl, companyId: targetCompanyId });
        if (onAddAuditLog) {
          onAddAuditLog(currentUser, 'edit', `ربط الشريك وتوثيقه: ${partner.name} بالشركة: ${coName}`);
        }
        alert('تم ربط الشريك كـ موكل للشركة بنجاح!');
      }
    } else {
      if (onAddClient) {
        const newCl: Client = {
          id: `client-${Date.now()}`,
          name: partner.name,
          phone: partner.phone || '',
          nationalId: partner.nationalId || undefined,
          address: partner.address || '',
          job: 'شريك وممثل قانوني للشركة',
          companyId: targetCompanyId
        };
        onAddClient(newCl);
        if (onAddAuditLog) {
          onAddAuditLog(currentUser, 'add', `تأسيس شركة: تسجيل الموكل الشريك ${partner.name} كـ ممثل قانوني معتمد`);
        }
        alert('تم تسجيل الشريك كـ موكل جديد وربطه بالشركة تلقائياً بنجاح!');
      }
    }
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

    const todayStr = new Date().toISOString().split('T')[0];

    if (stagedCompanyFile) {
      if (!stagedCompanyFile.file) return;

      setIsCompanyDocUploading(true);

      const fileToUpload = stagedCompanyFile.file;
      const newDocId = `cd-${Date.now()}`;

      // Structured storage path companies/{companyId}/documents/{fileName}
      const fileExt = fileToUpload.name.split('.').pop() || '';
      const cleanNameWithoutSpaces = docName.trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
      const sanitizedFileName = `${cleanNameWithoutSpaces}.${fileExt}`;

      const storagePath = `companies/${currentCompanyId || `company-${Date.now()}`}/documents/${sanitizedFileName}`;
      const storageRef = ref(storage, storagePath);

      uploadFile(storageRef, fileToUpload, newDocId, async (downloadURL) => {
        const newDoc: CompanyDoc = {
          id: newDocId,
          name: docName.trim(),
          type: (docType as any) === 'doc' ? 'pdf' : (docType as any),
          uploadDate: todayStr,
          fileUrl: downloadURL,
          storagePath: storagePath,
          downloadURL: downloadURL
        };

        if (editingCompany) {
          setCompanyDocsList(prev => {
            const exists = prev.some(d => d.id === newDocId);
            const newList = exists
              ? prev.map(d => d.id === newDocId ? { ...d, fileUrl: downloadURL, downloadURL: downloadURL } : d)
              : [...prev, newDoc];

            const updatedCompany = { ...editingCompany, documents: newList };
            onUpdateCompany(updatedCompany);
            return newList;
          });
        } else {
          setCompanyDocsList(prev => {
            const exists = prev.some(d => d.id === newDocId);
            return exists
              ? prev.map(d => d.id === newDocId ? { ...d, fileUrl: downloadURL, downloadURL: downloadURL } : d)
              : [...prev, newDoc];
          });
        }
      })
      .then(() => {
        setDocName('');
        setStagedCompanyFile(null);
        setIsCompanyDocUploading(false);
        alert('✅ تم رفع المستند القانوني وحفظه بنجاح!');
      })
      .catch((err) => {
        alert(`❌ فشل رفع ملف الشركة: ${err.message || err}`);
        setIsCompanyDocUploading(false);
      });
    } else {
      // Manual upload simulation with auto-generated link
      const newDocId = `cd-${Date.now()}`;
      const newDoc: CompanyDoc = {
        id: newDocId,
        name: docName.trim(),
        type: docType,
        uploadDate: todayStr,
        fileUrl: '#'
      };

      const newList = [...companyDocsList, newDoc];
      setCompanyDocsList(newList);

      if (editingCompany) {
        const updatedCompany = { ...editingCompany, documents: newList };
        onUpdateCompany(updatedCompany);
      }

      setDocName('');
    }
  };

  // Real company file upload from device
  const handleCompanyDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detect file type from extension
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

    // Pre-fill the form inputs so the user can easily review or edit them
    setDocName(originalCleanName);
    setDocType(detectedType);
    
    // Clear input value so same file can be uploaded again if needed
    e.target.value = '';
  };

  // Real session file upload from device
  const handleSessionDeviceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    setStagedSessionFile({
      file,
      fileUrl: objectUrl,
      type: detectedType,
      size: `${sizeInMB} MB`,
      originalName: originalCleanName
    });

    setRollPhotoUrl(file.name);
    e.target.value = '';
  };

  // Remove Document from Company Form
  const handleRemoveCompanyDoc = (docId: string) => {
    const docToDelete = companyDocsList.find(d => d.id === docId);
    if (docToDelete && docToDelete.storagePath) {
      const storageRef = ref(storage, docToDelete.storagePath);
      deleteObject(storageRef).catch(err => {
        console.warn("Failed to delete company doc from storage:", err);
      });
    }

    const newList = companyDocsList.filter(d => d.id !== docId);
    setCompanyDocsList(newList);

    if (editingCompany) {
      const updatedCompany = { ...editingCompany, documents: newList };
      onUpdateCompany(updatedCompany);
    }
  };

  // View Company Document in extreme fast dedicated popup window (Applying the Word/PDF simulation system)
  const handleViewCompanyDoc = async (doc: CompanyDoc, company: Company) => {
    let fileUrl = doc.downloadURL || doc.fileUrl;

    // Check if we have this file stored in our permanent IndexedDB database first!
    if (doc.id) {
      const dbBlob = await getFileFromIndexedDB(doc.id);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    } else if (doc.fileUrl && doc.fileUrl.startsWith('blob:')) {
      const dbBlob = await getFileFromIndexedDB(doc.fileUrl);
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

    // A. If it is a real online URL, proxy it to bypass ISP blocking!
    if (finalFileUrl && finalFileUrl.startsWith('http')) {
      const targetUrl = getProxiedUrl(finalFileUrl);
      const newWin = window.open(targetUrl, '_blank');
      if (newWin) {
        newWin.focus();
      } else {
        alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
      }
      return;
    }

    const isBlob = finalFileUrl.startsWith('blob:');
    
    // 1. If it's a blob (local browser file)
    if (isBlob) {
      // Verify if blob is valid on this specific device/session
      let isValidBlob = false;
      try {
        const response = await fetch(finalFileUrl, { method: 'HEAD' });
        if (response.ok) isValidBlob = true;
      } catch (e) {
        isValidBlob = false;
      }

      if (!isValidBlob) {
        alert('⚠️ عذراً، هذا الملف تم حفظه محلياً فقط على الجهاز الآخر الذي قام برفع أول مرة ولم يكتمل رفعه بعد إلى السحابة بسبب ضعف الاتصال على ذلك الجهاز.');
        return;
      }

      if (doc.type === 'pdf') {
        const targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(doc.name)}&fileId=${doc.id || ''}`;
        const newWin = window.open(targetUrl, '_blank', 'width=1100,height=850,scrollbars=yes,status=yes,resizable=yes');
        if (newWin) {
          newWin.focus();
        } else {
          alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
        }
      } else {
        const newWin = window.open(finalFileUrl, '_blank');
        if (newWin) {
          newWin.focus();
        } else {
          alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
        }
      }
      return;
    }

    // 2. Simulated/placeholder document (Word/Doc files or simulated PDFs)
    if (!doc.fileUrl || doc.fileUrl === '#' || doc.type === 'word' || doc.type === 'doc') {
      const newWin = window.open('', '_blank', 'width=900,height=800,scrollbars=yes,resizable=yes');
      if (newWin) {
        let bodyHtml = '';
        
        // Generate beautiful corporate document body based on document name
        if (doc.name.includes('تأسيس') || doc.name.includes('عقد')) {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">عقـد تأسيس شركة وتعيين المدير</h4>
            <p>إنه في يوم الموافق ${doc.uploadDate}، قد تم الاتفاق والتراضي بين الشركاء الموقعين أدناه على تأسيس شركة تجارية خاضعة للقوانين والأنظمة المعمول بها في جمهورية مصر العربية، ووفقاً للأحكام والشروط التالية:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0; line-height: 2;">
              <strong>البند الأول (الاسم والنوع):</strong>
              <p>اسم الشركة التجاري هو: <strong>${company.name}</strong>، ونوعها القانوني هو: <strong>${company.companyType || 'شركة مساهمة'}</strong>.</p>
              <strong>البند الثاني (مقر الشركة):</strong>
              <p>يقع المقر الرئيسي للشركة في العنوان التالي: <strong>${company.address || 'العنوان المختار بالملف'}</strong>.</p>
              <strong>البند الثالث (النشاط التجاري):</strong>
              <p>الغرض الأساسي لتأسيس الشركة هو ممارسة نشاط: <strong>${company.activityType || 'المقاولات والخدمات العامة'}</strong>.</p>
            </div>
            <div style="margin-top: 15px;">
              <strong>جدول الحصص والشركاء في رأس المال:</strong>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; text-align: right;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">اسم الشريك</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">نسبة المشاركة</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">قيمة الحصة بالجنيه</th>
                    <th style="padding: 8px; border: 1px solid #e2e8f0;">رقم الهوية</th>
                  </tr>
                </thead>
                <tbody>
                  ${company.partners && company.partners.length > 0 ? company.partners.map(p => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${p.name}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #b45309;">${p.participationPercentage}%</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${p.shareValue.toLocaleString()} ج.م</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${p.nationalId}</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="4" style="padding: 8px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">لم يتم تسجيل الشركاء تفصيلياً بالعقد الإلكتروني</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold; color: #1e293b;">أحكام ختامية والتوقيعات:</p>
              <p>يتعهد الشركاء بالالتزام التام ببنود العقد القانونية، والتعاون مع مكتب الأستاذ أبو رميح للمحاماة والاستشارات بصفته المستشار القانوني المعتمد والممثل القانوني للشركة أمام الهيئات والوزارات المعنية.</p>
            </div>
          `;
        } else if (doc.name.includes('سجل') || doc.name.includes('تجاري')) {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">مستخرج رسمي من السجل التجاري</h4>
            <p>وزارة التجارة والصناعة - مصلحة التسجيل التجاري بمصر:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0; line-height: 2;">
              <p>بناء على الطلب المقدم من مكتب الاستشارات والخدمات القانونية، نشهد بأن الشركة المبين بياناتها أدناه مقيدة بالسجل التجاري تحت البيانات الرسمية المعتمدة التالية:</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                <tr>
                  <td style="padding: 6px; font-weight: bold; width: 30%;">اسم المنشأة/الشركة:</td>
                  <td style="padding: 6px;"><strong>${company.name}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">رقم السجل التجاري:</td>
                  <td style="padding: 6px; font-weight: bold; color: #b45309;">${company.commercialRegister}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">نوع الشركة القانوني:</td>
                  <td style="padding: 6px;">${company.companyType || 'شركة مساهمة'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">عنوان المقر الرئيسي:</td>
                  <td style="padding: 6px;">${company.address}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">النشاط التجاري المعتمد:</td>
                  <td style="padding: 6px;">${company.activityType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">رأس مال الشركة:</td>
                  <td style="padding: 6px;">${(company.partners?.reduce((acc, curr) => acc + curr.shareValue, 0) || 5000000).toLocaleString()} ج.م</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 11px; color: #475569; font-style: italic; text-align: center; margin-top: 25px;">يعد هذا المستند مستخرجاً إلكترونياً معتمداً ومطابقاً للبيانات في الدفاتر الرسمية حتى تاريخ استخراجه.</p>
          `;
        } else if (doc.name.includes('ضريبية') || doc.name.includes('بطاقة')) {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">البطاقة الضريبية الرسمية</h4>
            <p>وزارة المالية - مصلحة الضرائب المصرية:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0; line-height: 2;">
              <p>تشهد مصلحة الضرائب المصرية بأن الممول المذكور أدناه مسجل لدى المأمورية المختصة وله ملف ضريبي يحمل الرقم والبيانات المعتمدة التالية:</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                <tr>
                  <td style="padding: 6px; font-weight: bold; width: 30%;">اسم الممول (الشركة):</td>
                  <td style="padding: 6px;"><strong>${company.name}</strong></td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">رقم التسجيل الضريبي:</td>
                  <td style="padding: 6px; font-weight: bold; color: #b45309;">${company.taxCard}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">العنوان والمركز الرئيسي:</td>
                  <td style="padding: 6px;">${company.address}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">طبيعة النشاط الضريبي:</td>
                  <td style="padding: 6px;">${company.activityType}</td>
                </tr>
                <tr>
                  <td style="padding: 6px; font-weight: bold;">الكيان القانوني:</td>
                  <td style="padding: 6px;">${company.companyType || 'شركة مساهمة'}</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 11px; color: #475569; font-style: italic; text-align: center; margin-top: 25px;">تاريخ إصدار البطاقة: 2026/01/15 وتعتبر سارية وصالحة للاستخدام القانوني والتعامل المالي الفوري.</p>
          `;
        } else {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">مستند رسمي معتمد للمنشأة</h4>
            <p>يقر مكتب الأستاذ أبو رميح للمحاماة والاستشارات القانونية بصحة وإرفاق هذا المستند المودع بملف الشركة <strong>"${company.name}"</strong> والمسجل تحت مسمى:</p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center; margin: 20px 0;">
              <strong style="font-size: 16px; color: #b45309;">"${doc.name}"</strong>
              <div style="font-size: 11px; color: #64748b; margin-top: 5px;">تاريخ الرفع: ${doc.uploadDate} | صيغة الملف: ${doc.type.toUpperCase()}</div>
            </div>
            <p>تم فحص وتدقيق هذه الوثيقة ومطابقتها للسجلات المودعة بملف التأسيس والشركاء بمؤسستنا، وتعد جزءاً من الهوية القانونية المعتمدة للشركة في مباشرة تعاملاتها والخصومات القضائية والتمثيل الإداري والدستوري لها.</p>
          `;
        }

        newWin.document.write(`
          <html dir="rtl">
            <head>
              <title>${doc.name} - عارض المستندات السريع</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body {
                  font-family: 'Cairo', sans-serif;
                  background-color: #f8fafc;
                  color: #1e293b;
                  padding: 40px;
                  margin: 0;
                  direction: rtl;
                  text-align: right;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                  border: 1px solid #e2e8f0;
                  min-height: 600px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #b45309;
                  padding-bottom: 15px;
                  margin-bottom: 30px;
                  font-size: 12px;
                  color: #475569;
                }
                .footer {
                  border-top: 1px solid #e2e8f0;
                  padding-top: 20px;
                  margin-top: 40px;
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  color: #64748b;
                }
                .btn-print {
                  background-color: #b45309;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 6px;
                  font-family: 'Cairo', sans-serif;
                  font-weight: bold;
                  cursor: pointer;
                  margin-bottom: 20px;
                }
                .btn-print:hover {
                  background-color: #92400e;
                }
                @media print {
                  body { background: white; padding: 0; }
                  .container { box-shadow: none; border: none; padding: 0; }
                  .btn-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div style="text-align: left; max-width: 800px; margin: 0 auto;">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة المستند</button>
              </div>
              <div class="container">
                <div>
                  <div class="header">
                    <div>
                      <strong>مؤسسة رميح للمحاماة والاستشارات القانونية</strong><br/>
                      <span>تأسيس وخبرة قانونية عريقة</span>
                    </div>
                    <div style="text-align: left;">
                      <span>تاريخ الرفع: ${doc.uploadDate}</span><br/>
                      <span>الرافع: المستشار القانوني المعتمد</span>
                    </div>
                  </div>
                  <div style="line-height: 1.8; font-size: 14px;">
                    ${bodyHtml}
                  </div>
                </div>
                <div class="footer">
                  <div>بوابة الإدارة الرقمية المتكاملة لمؤسسة رميح القانونية © 2026</div>
                  <div style="font-weight: bold; color: #e11d48;">مستند معتمد إلكترونياً</div>
                </div>
              </div>
            </body>
          </html>
        `);
        newWin.document.close();
      } else {
        alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية المستند.');
      }
      return;
    }

    // 3. Public/online URLs
    const absoluteFileUrl = fileUrl.startsWith('http') 
      ? fileUrl 
      : `${window.location.origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;

    let targetUrl = '';
    if (doc.type === 'image') {
      targetUrl = absoluteFileUrl;
    } else if (doc.type === 'pdf') {
      targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(doc.name)}&fileId=${doc.id || ''}`;
    } else {
      targetUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteFileUrl)}&hl=ar`;
    }

    const newWin = window.open(targetUrl, '_blank', 'width=1100,height=850,scrollbars=yes,status=yes,resizable=yes');
    if (newWin) {
      newWin.focus();
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  // Open Company Form Modal
  const handleOpenCompanyForm = (company: Company | null) => {
    setEditingCompany(company);
    setStagedCompanyFile(null);
    setDocName('');
    setActiveCompanyFormTab('primary');
    setCompanyStageTab(company?.stage || 'establishment');
    setSelectedClientToLink('');
    setShowNewClientForm(false);
    
    // Reset Quick Client fields
    setNewClientName('');
    setNewClientPhone('');
    setNewClientNationalId('');
    setNewClientAddress('');
    setNewClientJob('');
    setNewClientEmail('');
    setNewClientNotes('');

    // Reset Quick Task fields
    setCompanyTaskTitle('');
    setCompanyTaskDesc('');
    setCompanyTaskDueDate(new Date().toISOString().split('T')[0]);
    setCompanyTaskAssignedTo('');
    setCompanyTaskPriority('متوسطة');

    if (company) {
      setCoName(company.name);
      setCoType(company.companyType || 'شركة مساهمة');
      setCoRegister(company.commercialRegister);
      setCoTaxCard(company.taxCard);
      setCoVat(company.vatCertificate || '');
      setCoActivity(company.activityType);
      setCoAddress(company.address);
      setCoPhone(company.phone);
      setCoOfficeFileNumber(company.officeFileNumber || '');
      setCoPartners(company.partners || []);
      setCompanyDocsList(company.documents || []);
      setCurrentCompanyId(company.id);
    } else {
      setCoName('');
      setCoType('شركة مساهمة');
      setCoRegister('');
      setCoTaxCard('');
      setCoVat('');
      setCoActivity('');
      setCoAddress('');
      setCoPhone('');
      setCoOfficeFileNumber('');
      setCoPartners([]);
      setCompanyDocsList([]);
      setCurrentCompanyId(`company-${Date.now()}`);
    }
    setShowCompanyModal(true);
  };

  // Submit Company Form
  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coName) {
      alert('يرجى كتابة اسم الشركة أولاً');
      return;
    }
    if (coPartners.length === 0) {
      alert('يرجى إضافة شريك واحد على الأقل للشركة أولاً باسمه');
      return;
    }

    const companyData: Company = {
      id: currentCompanyId || (editingCompany ? editingCompany.id : `company-${Date.now()}`),
      name: coName,
      companyType: coType,
      commercialRegister: coRegister,
      taxCard: coTaxCard,
      vatCertificate: coVat || undefined,
      activityType: coActivity,
      address: coAddress,
      phone: coPhone,
      officeFileNumber: coOfficeFileNumber || undefined,
      partners: coPartners,
      documents: companyDocsList,
      stage: companyStageTab,
      isArchived: editingCompany ? editingCompany.isArchived : false
    };

    // Ensure the first partner is automatically registered as a client and linked to this company
    if (coPartners.length > 0) {
      const firstPartner = coPartners[0];
      const targetCompanyId = companyData.id;
      const existingCl = clients.find(c => (firstPartner.phone && c.phone === firstPartner.phone) || c.name === firstPartner.name);
      if (existingCl) {
        if (existingCl.companyId !== targetCompanyId && onUpdateClient) {
          onUpdateClient({ ...existingCl, companyId: targetCompanyId });
        }
      } else {
        if (onAddClient) {
          const newCl: Client = {
            id: `client-${Date.now()}`,
            name: firstPartner.name,
            phone: firstPartner.phone || '',
            nationalId: firstPartner.nationalId || undefined,
            address: firstPartner.address || '',
            job: 'شريك رئيسي وممثل قانوني للشركة',
            companyId: targetCompanyId
          };
          onAddClient(newCl);
          if (onAddAuditLog) {
            onAddAuditLog(currentUser, 'add', `تأسيس شركة: تسجيل الموكل الشريك الأول ${firstPartner.name} كـ ممثل قانوني للشركة وتوثيقه بالنظام تلقائياً`);
          }
        }
      }
    }

    if (editingCompany) {
      onUpdateCompany(companyData);
      if (onAddAuditLog) {
        onAddAuditLog(currentUser, 'edit', `تعديل الملف القانوني للشركة: ${coName} (مرحلة: ${companyStageTab === 'establishment' ? 'التأسيس وقيد السجل' : 'ما بعد التأسيس'})`);
      }
    } else {
      onAddCompany(companyData);
      if (onAddAuditLog) {
        onAddAuditLog(currentUser, 'add', `تسجيل ملف شركة جديدة بالنظام: ${coName} (مرحلة: التأسيس وقيد السجل)`);
      }
    }
    setShowCompanyModal(false);
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

  // Open Form for Adding
  const handleOpenAdd = () => {
    setEditingCase(null);
    setOfficeFileNo('');
    setCaseNo1st('');
    setCaseYear1st('2026');
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
    setCaseType('جنح');
    setCustomCaseType('');
    setCourt('');
    setCircuit('');
    setNextHearing('');
    setNextHearingTime('09:00');
    setStatus('متداولة بجلسات المحكمة');
    setClientName(clients[0]?.name || '');
    setFormClients([{
      name: clients[0]?.name || '',
      role: 'مدعي',
      phone: clients[0]?.phone || '',
      email: clients[0]?.email || '',
      id: clients[0]?.id || ''
    }]);
    setOppName('');
    setFormOpponents([{
      name: '',
      role: 'مدعى عليه',
      address: '',
      phone: '',
      lawyer: '',
      lawyerPhone: '',
      notes: ''
    }]);
    setOppRole('مدعى عليه');
    setOppAddress('');
    setOppLawyer('');
    setOppPhone('');
    setOppLawyerPhone('');
    setNotes('');
    setCaseSubject('');
    setProsecutor('');
    setEnforcementNo('');
    setDegree('أول درجة');
    setTotalFees(15000);
    setPaidFees(5000);
    setAssignedLawyer(users.find(u => u.role === 'lawyer')?.id || '');
    setUploadedFiles([]);
    setCurrentCaseId(`case-${Date.now()}`);
    setStagedDeviceFile(null);
    setNewFileName('');
    setIsReferredToExperts(false);
    setExpertReferralDate('');
    setExpertCourtOrCircuit('');
    setExpertReferralReason('');
    setExpertOffice('');
    setExpertFileNumber('');
    setExpertName('');
    setExpertFirstSessionDate('');
    setExpertNotes('');
    setActiveFormTab('judicial');
    setShowFormModal(true);
  };

  // Open Form for Editing
  const handleOpenEdit = (c: Case) => {
    setEditingCase(c);
    setOfficeFileNo(c.officeFileNo || '');
    setCaseNo1st(c.caseNumberFirstInstance);
    setCaseYear1st(c.caseYearFirstInstance);
    setCaseNo2nd(c.caseNumberSecondInstance || '');
    setCaseYear2nd(c.caseYearSecondInstance || '');
    setCassationNumber(c.cassationNumber || '');
    setCassationYear(c.cassationYear || '');
    setCourt1st(c.courtFirstInstance || (c.degree === 'أول درجة' ? c.court : '') || '');
    setVenue1st(c.venueFirstInstance || '');
    setCircuit1st(c.circuitFirstInstance || (c.degree === 'أول درجة' ? c.circuit : '') || '');
    setCourt2nd(c.courtSecondInstance || (c.degree === 'استئناف' ? c.court : '') || '');
    setVenue2nd(c.venueSecondInstance || '');
    setCircuit2nd(c.circuitSecondInstance || (c.degree === 'استئناف' ? c.circuit : '') || '');
    setCourtCass(c.courtCassation || (c.degree === 'نقض' ? c.court : '') || '');
    setVenueCass(c.venueCassation || '');
    setCircuitCass(c.circuitCassation || (c.degree === 'نقض' ? c.circuit : '') || '');
    setShowAppealSection(!!(c.caseNumberSecondInstance || c.courtSecondInstance || c.degree === 'استئناف'));
    setShowCassationSection(!!(c.cassationNumber || c.courtCassation || c.degree === 'نقض'));
    setCaseType(c.type);
    setCustomCaseType('');
    setCourt(c.court);
    setCircuit(c.circuit);
    setNextHearing(c.nextHearingDate || '');
    setNextHearingTime(c.nextHearingTime || '09:00');
    setStatus(c.status);
    setClientName(c.clientName);
    const matchedClient = clients.find(cl => cl.id === c.clientId || cl.name === c.clientName);
    const loadedClients: CaseClient[] = c.clientsList && c.clientsList.length > 0
      ? c.clientsList
      : [{
          name: c.clientName,
          role: 'مدعي',
          phone: matchedClient?.phone || '',
          email: matchedClient?.email || '',
          id: c.clientId
        }];
    setFormClients(loadedClients);

    setOppName(c.opponent.name);
    setOppRole(c.opponent.role);
    setOppAddress(c.opponent.address);
    setOppLawyer(c.opponent.lawyer);
    setOppPhone(c.opponent.phone);
    setOppLawyerPhone(c.opponent.lawyerPhone || '');
    
    const loadedOpponents: Opponent[] = c.opponentsList && c.opponentsList.length > 0
      ? c.opponentsList
      : [{
          name: c.opponent.name,
          role: c.opponent.role,
          address: c.opponent.address,
          lawyer: c.opponent.lawyer,
          phone: c.opponent.phone,
          lawyerPhone: c.opponent.lawyerPhone,
          notes: c.opponent.notes
        }];
    setFormOpponents(loadedOpponents);
    setNotes(c.notes || '');
    setCaseSubject(c.subject || '');
    setProsecutor(c.prosecutorName || '');
    setEnforcementNo(c.enforcementNumber || '');
    setDegree(c.degree);
    setTotalFees(c.totalFees);
    setPaidFees(c.paidFees);
    setAssignedLawyer(c.assignedLawyerId || '');
    setUploadedFiles(c.files || []);
    setCurrentCaseId(c.id);
    setStagedDeviceFile(null);
    setNewFileName('');
    setIsReferredToExperts(!!(c.isReferredToExperts || c.expertReferral?.isReferred));
    setExpertReferralDate(c.expertReferral?.referralDate || '');
    setExpertCourtOrCircuit(c.expertReferral?.courtOrCircuit || c.court || '');
    setExpertReferralReason(c.expertReferral?.referralReason || '');
    setExpertOffice(c.expertReferral?.expertOffice || '');
    setExpertFileNumber(c.expertReferral?.fileNumber || '');
    setExpertName(c.expertReferral?.expertName || '');
    setExpertFirstSessionDate(c.expertReferral?.firstSessionDate || '');
    setExpertNotes(c.expertReferral?.notes || '');
    setActiveFormTab('judicial');
    setShowFormModal(true);
  };

  const addFormClient = () => {
    setFormClients([
      ...formClients,
      { name: '', role: 'مدعي', phone: '', email: '' }
    ]);
  };

  const updateFormClient = (index: number, updated: Partial<CaseClient>) => {
    const updatedList = [...formClients];
    updatedList[index] = { ...updatedList[index], ...updated };
    setFormClients(updatedList);
  };

  const removeFormClient = (index: number) => {
    if (formClients.length <= 1) {
      alert('يجب الإبقاء على موكل واحد على الأقل.');
      return;
    }
    setFormClients(formClients.filter((_, i) => i !== index));
  };

  const addFormOpponent = () => {
    setFormOpponents([
      ...formOpponents,
      { name: '', role: 'مدعى عليه', address: '', phone: '', lawyer: '', lawyerPhone: '' }
    ]);
  };

  const updateFormOpponent = (index: number, updated: Partial<Opponent>) => {
    const updatedList = [...formOpponents];
    updatedList[index] = { ...updatedList[index], ...updated };
    setFormOpponents(updatedList);
  };

  const removeFormOpponent = (index: number) => {
    setFormOpponents(formOpponents.filter((_, i) => i !== index));
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty clients
    const validClients = formClients.filter(cl => cl.name && cl.name.trim() !== '');
    if (validClients.length === 0) {
      alert('اسم موكل واحد على الأقل مطلوب لإنشاء القضية.');
      return;
    }

    const firstClient = validClients[0];
    const selectedClientId = clients.find(cl => cl.name === firstClient.name)?.id || firstClient.id || `client-${Date.now()}`;
    const primaryClientName = firstClient.name;

    // Filter out empty opponents
    const validOpponents = formOpponents.filter(opp => opp.name && opp.name.trim() !== '');
    const firstOpponent = validOpponents[0] || {
      name: 'غير محدد',
      role: 'مدعى عليه',
      address: '',
      lawyer: '',
      phone: '',
      lawyerPhone: ''
    };

    const actualCaseType = caseType === 'أخرى' && customCaseType ? customCaseType : caseType;

    // Determine primary court and circuit based on active litigation degree for backwards compatibility
    let primaryCourt = court;
    let primaryCircuit = circuit;

    if (degree === 'أول درجة') {
      primaryCourt = court1st;
      primaryCircuit = circuit1st;
    } else if (degree === 'استئناف') {
      primaryCourt = court2nd;
      primaryCircuit = circuit2nd;
    } else if (degree === 'نقض') {
      primaryCourt = courtCass;
      primaryCircuit = circuitCass;
    }

    // Build Expert Referral object if enabled
    let expertReferralData = editingCase?.expertReferral;
    if (isReferredToExperts) {
      expertReferralData = {
        ...(editingCase?.expertReferral || {}),
        isReferred: true,
        referralDate: expertReferralDate || new Date().toISOString().split('T')[0],
        courtOrCircuit: expertCourtOrCircuit || primaryCourt || '',
        referralReason: expertReferralReason,
        expertOffice: expertOffice,
        fileNumber: expertFileNumber,
        expertName: expertName,
        firstSessionDate: expertFirstSessionDate,
        notes: expertNotes,
        status: editingCase?.expertReferral?.status || 'قيد مباشرة الخبير'
      };
    }

    const updatedCaseStatus = (isReferredToExperts && status === 'متداولة بجلسات المحكمة') ? 'محالة إلى الخبراء' : status;

    const caseData: Case = {
      id: currentCaseId || (editingCase ? editingCase.id : `case-${Date.now()}`),
      officeFileNo: officeFileNo || undefined,
      caseNumberFirstInstance: caseNo1st,
      caseYearFirstInstance: caseYear1st,
      caseNumberSecondInstance: caseNo2nd || undefined,
      caseYearSecondInstance: caseYear2nd || undefined,
      cassationNumber: cassationNumber || undefined,
      cassationYear: cassationYear || undefined,
      courtFirstInstance: court1st || undefined,
      venueFirstInstance: venue1st || undefined,
      circuitFirstInstance: circuit1st || undefined,
      courtSecondInstance: court2nd || undefined,
      venueSecondInstance: venue2nd || undefined,
      circuitSecondInstance: circuit2nd || undefined,
      courtCassation: courtCass || undefined,
      venueCassation: venueCass || undefined,
      circuitCassation: circuitCass || undefined,
      type: actualCaseType,
      court: primaryCourt,
      circuit: primaryCircuit,
      nextHearingDate: nextHearing || undefined,
      nextHearingTime: nextHearingTime || undefined,
      status: updatedCaseStatus,
      clientName: primaryClientName,
      clientId: selectedClientId,
      opponent: {
        name: firstOpponent.name || 'غير محدد',
        role: firstOpponent.role || 'مدعى عليه',
        address: firstOpponent.address || '',
        lawyer: firstOpponent.lawyer || '',
        phone: firstOpponent.phone || '',
        lawyerPhone: firstOpponent.lawyerPhone || ''
      },
      clientsList: validClients,
      opponentsList: validOpponents.length > 0 ? validOpponents : [firstOpponent],
      notes: notes || undefined,
      subject: caseSubject || undefined,
      prosecutorName: prosecutor || undefined,
      enforcementNumber: enforcementNo || undefined,
      degree,
      totalFees: Number(totalFees),
      paidFees: Number(paidFees),
      remainingFees: Number(totalFees) - Number(paidFees),
      payments: editingCase ? editingCase.payments : [
        {
          id: `pay-${Date.now()}`,
          amount: Number(paidFees),
          date: new Date().toISOString().split('T')[0],
          receiptNumber: `سند رقم ${Math.floor(1000 + Math.random() * 9000)}`,
          notes: 'مقدم دفع مالي مسجل عند فتح ملف القضية'
        }
      ],
      files: uploadedFiles,
      isArchived: editingCase ? editingCase.isArchived : false,
      assignedLawyerId: assignedLawyer || undefined,
      isReferredToExperts: isReferredToExperts,
      expertReferral: expertReferralData
    };

    if (editingCase) {
      onUpdateCase(caseData);
    } else {
      onAddCase(caseData);
    }

    setShowFormModal(false);
  };

  // Archive execution
  const handleArchiveSubmit = () => {
    if (!archiveTarget) return;
    if (!archivePassword) {
      setArchiveError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    const userPassword = currentUser.password || currentUser.phone;
    if (archivePassword !== userPassword) {
      setArchiveError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك.');
      return;
    }
    const actualReason = archiveReason === 'سبب آخر' ? customArchiveReason : archiveReason;
    onArchiveCase(archiveTarget.id, actualReason || 'بناءً على طلب المدير', archiveNotes);
    setArchiveTarget(null);
    setArchivePassword('');
    setArchiveError('');
  };

  // Submit Decision / Outcome from CasesPanel
  const handleDecisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionSession || !onUpdateSession) return;

    let finalRollPhotoUrl = rollPhotoUrl;

    if (stagedSessionFile) {
      finalRollPhotoUrl = stagedSessionFile.fileUrl;

      // Find the associated case and append this file to its documents list
      const associatedCase = cases.find(c => c.id === decisionSession.caseId);
      if (associatedCase) {
        const newFileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newCaseFile = {
          id: newFileId,
          name: stagedSessionFile.originalName || `قرار جلسة ${decisionSession.date}`,
          type: stagedSessionFile.type,
          category: 'قرار جلسة',
          uploadDate: new Date().toISOString().split('T')[0],
          size: stagedSessionFile.size,
          fileUrl: stagedSessionFile.fileUrl,
          downloadURL: stagedSessionFile.fileUrl,
          uploadedBy: currentUser?.fullName || 'النظام'
        };

        const updatedCase = {
          ...associatedCase,
          files: [...(associatedCase.files || []), newCaseFile]
        };
        onUpdateCase(updatedCase);
      }
    }

    const updated: HearingSession = {
      ...decisionSession,
      status: 'completed',
      decision: decisionText,
      nextHearingDate: decisionNextHearingDate || undefined,
      rollPhotoUrl: finalRollPhotoUrl || undefined
    };

    onUpdateSession(updated);
    setDecisionSession(null);
    setDecisionText('');
    setDecisionNextHearingDate('');
    setDecisionNextHearingTime('09:00');
    setRollPhotoUrl('');
    setStagedSessionFile(null);
  };

  // Permanent Delete (Super Admin only)
  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    if (!adminPassword) {
      setDeleteError('كلمة المرور مطلوبة للتأكيد النهائي');
      return;
    }
    // Simple password check for local demo
    const userPassword = currentUser.password || currentUser.phone;
    if (adminPassword !== userPassword) {
      setDeleteError('كلمة المرور غير صحيحة. يرجى إدخال كلمة سر الدخول الخاصة بك لتأكيد الحذف.');
      return;
    }

    const success = onDeleteCase(deleteTarget.id, deleteReason || 'تطهير ملفات مغلقة', adminPassword);
    if (success) {
      setDeleteTarget(null);
      setDeleteReason('');
      setAdminPassword('');
      setDeleteError('');
    } else {
      setDeleteError('فشلت العملية. يرجى مراجعة الصلاحيات.');
    }
  };

  const handleAddSessionFromViewer = (c: Case) => {
    if (!onAddSession) return;
    if (!newSessDate) {
      alert('يرجى تحديد تاريخ الجلسة أولاً.');
      return;
    }
    if (!newSessSubject.trim()) {
      alert('يرجى تحديد موضوع الجلسة أو الطلبات.');
      return;
    }

    const assignedLawyer = users.find(u => u.id === newSessLawyerId);

    const newSession: HearingSession = {
      id: `session-${Date.now()}`,
      caseId: c.id,
      caseNumber: c.caseNumberFirstInstance,
      caseYear: c.caseYearFirstInstance,
      clientName: c.clientName,
      opponentName: c.opponent?.name || 'غير محدد',
      court: c.court || 'غير محدد',
      circuit: c.circuit || 'غير محدد',
      type: c.type,
      date: newSessDate,
      time: newSessTime || '09:00',
      subject: newSessSubject.trim(),
      status: 'pending',
      assignedLawyerId: newSessLawyerId || undefined,
      assignedLawyerName: assignedLawyer?.fullName || undefined,
      notes: 'تمت إضافتها يدوياً من داخل ملف القضايا (رول القضايا)'
    };

    onAddSession(newSession);
    
    // Reset form states
    setNewSessDate('');
    setNewSessTime('09:00');
    setNewSessSubject('');
    setNewSessLawyerId('');
    setShowAddSessionForm(false);
    
    alert('تم إضافة الجلسة ورصدها في الأجندة بنجاح!');
  };

  // Document upload simulator function
  const handleSimulateUpload = () => {
    if (!newFileName) {
      alert('يرجى كتابة اسم الملف المراد إرفاقه');
      return;
    }

    const newFile: CaseFile = {
      id: `file-${Date.now()}`,
      name: newFileName,
      type: newFileType,
      category: newFileCategory,
      uploadDate: new Date().toISOString().split('T')[0],
      size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
      fileUrl: '#'
    };

    setUploadedFiles([...uploadedFiles, newFile]);
    setNewFileName('');
  };

  // Real file upload from device
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

  // Helper to remove document from simulation & Firebase Storage
  const handleRemoveFile = async (fileId: string) => {
    const fileToRemove = uploadedFiles.find(f => f.id === fileId);
    if (fileToRemove && fileToRemove.storagePath) {
      try {
        const fileRef = ref(storage, fileToRemove.storagePath);
        await deleteObject(fileRef);
        console.log("Deleted file from Firebase Storage:", fileToRemove.storagePath);
      } catch (err) {
        console.error("Error deleting file from Firebase Storage:", err);
      }
    }

    const updatedList = uploadedFiles.filter(f => f.id !== fileId);
    setUploadedFiles(updatedList);

    // If we are currently editing an active case, save this removal to Firestore immediately
    if (editingCase) {
      try {
        const updatedCase = { ...editingCase, files: updatedList };
        onUpdateCase(updatedCase);
      } catch (err) {
        console.error("Failed to update case files list in Firestore after deletion:", err);
      }
    }
  };

  // Unified extremely fast file viewer that opens files in an independent, dedicated popup/new window.
  // This replaces all old modals, iframes, and loading delays.
  const handleViewFile = async (file: CaseFile) => {
    let fileUrl = file.downloadURL || file.fileUrl;

    // Check if we have this file stored in our permanent IndexedDB database first!
    if (file.id) {
      const dbBlob = await getFileFromIndexedDB(file.id);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    } else if (file.fileUrl && file.fileUrl.startsWith('blob:')) {
      const dbBlob = await getFileFromIndexedDB(file.fileUrl);
      if (dbBlob) {
        fileUrl = URL.createObjectURL(dbBlob);
      }
    }

    const finalFileUrl = !fileUrl || fileUrl === '#'
      ? (file.type === 'pdf'
          ? '/sample.pdf'
          : file.type === 'image'
            ? 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80'
            : '')
      : fileUrl;

    // A. If it is a real online URL, proxy it to bypass ISP blocking!
    if (finalFileUrl && finalFileUrl.startsWith('http')) {
      const targetUrl = getProxiedUrl(finalFileUrl);
      const newWin = window.open(targetUrl, '_blank');
      if (newWin) {
        newWin.focus();
      } else {
        alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
      }
      return;
    }

    const isBlob = finalFileUrl.startsWith('blob:');
    
    // 1. If it's a blob (local browser file)
    if (isBlob) {
      // Verify if blob is valid on this specific device/session
      let isValidBlob = false;
      try {
        const response = await fetch(finalFileUrl, { method: 'HEAD' });
        if (response.ok) isValidBlob = true;
      } catch (e) {
        isValidBlob = false;
      }

      if (!isValidBlob) {
        alert('⚠️ عذراً، هذا الملف تم حفظه محلياً فقط على الجهاز الآخر الذي قام برفع أول مرة ولم يكتمل رفعه بعد إلى السحابة بسبب ضعف الاتصال على ذلك الجهاز.');
        return;
      }

      if (file.type === 'pdf') {
        const targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(file.name)}&fileId=${file.id || ''}`;
        const newWin = window.open(targetUrl, '_blank', 'width=1100,height=850,scrollbars=yes,status=yes,resizable=yes');
        if (newWin) {
          newWin.focus();
        } else {
          alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
        }
      } else {
        const newWin = window.open(finalFileUrl, '_blank');
        if (newWin) {
          newWin.focus();
        } else {
          alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية الملف.');
        }
      }
      return;
    }

    // 2. If it's a simulated/placeholder document (no actual online file) or word document
    if (!fileUrl || fileUrl === '#' || file.type === 'word') {
      // Open a beautiful independent window that renders the legal document simulation cleanly
      const newWin = window.open('', '_blank', 'width=900,height=800,scrollbars=yes,resizable=yes');
      if (newWin) {
        const title = file.category === 'أحكام' ? 'حكــم قضائي صادر باسم الشَّعْب' : 
                      file.category === 'مذكرات' ? 'مذكرة بدفاع ودفوع السيد الموكل القانونية' : 
                      file.category === 'صحف الدعاوى' ? 'صحيفة افتتاح دعوى قضائية رسمية' : 
                      'مستند رسمي ومرفق قانوني معتمد';
        let bodyHtml = '';
        if (file.category === 'أحكام') {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">حكم صادر باسم الشعب</h4>
            <p>أصدرت الدائرة المدنية بمحكمة الاستئناف العالي الحكم التالي في الدعوى المقيدة برقم الاستئناف المذكور أعلاه، المقامة من المستأنف ضد المستأنف ضده، وبعد تلاوة تقرير التلخيص ومسودة الحكم وسماع المرافعة القانونية الشفهية والاطلاع على الأوراق والمداولة قانوناً:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0;">
              <strong>المحكمة:</strong>
              <p>حيث إن وقائع التداعي تخلص في أن المستأنف قد أقام دعواه بطلب القضاء له بالطلبات الواردة بأصل صحيفة الدعوى. وحيث إن الحكم المستأنف قد قضى في منطوقه برفض الدعوى وإلزام رافعها بالمصروفات. وحيث إن هذا القضاء لم يلقَ قبولاً لدى المستأنف فأقام طعنه الماثل بموجب صحيفة استئنافية أودعت قلم كتاب هذه المحكمة استند فيها إلى أسباب حاصلها الخطأ في تطبيق القانون وقصور التسبيب الفعلي وفساد الاستدلال بمستندات الملف.</p>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold; color: #1e293b;">فلهذه الأسباب، قررت المحكمة:</p>
              <ol style="padding-right: 20px; line-height: 1.8;">
                <li>قبول الاستئناف شكلاً لتقديمه في الميعاد القانوني المستقر عليه.</li>
                <li>وفي الموضوع، بإلغاء الحكم المستأنف والقضاء مجدداً بإلزام المستأنف ضده بأداء الحقوق والمطالبات القانونية كاملة لصالح موكل مؤسسة رميح للمحاماة، وإلزام المستأنف ضده بالمصروفات وأتعاب المحاماة المحددة.</li>
              </ol>
            </div>
          `;
        } else if (file.category === 'مذكرات') {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">مذكرة بدفوع ودفاع</h4>
            <p style="font-weight: bold; text-align: center; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">مقدمة من مكتب الأستاذ أبو رميح للمحاماة بصفتنا وكلاء عن المتهم / المدعي.</p>
            <p>نلتمس من الهيئة الموقرة القضاء وبحق بطلباتنا الجوهرية تأسيساً على الدفوع القانونية والدستورية التالية التي نبديها دفاعاً عن الموكل في الجلسة المقررة:</p>
            <ul style="padding-right: 20px; line-height: 2;">
              <li><strong>أولاً:</strong> الدفع ببطلان إجراءات الضبط والتحقيق لانتفاء حالة التلبس ولعدم وجود إذن مسبق من النيابة العامة.</li>
              <li><strong>ثانياً:</strong> الدفع بانتفاء الركن المادي والمعنوي للجريمة المنسوبة للموكل لعدم صحة الإسناد الفعلي للأدلة المرفقة.</li>
              <li><strong>ثالثاً:</strong> كيدية الاتهام وتلفيقه واستحالة تصور حدوث الواقعة وفق التصوير الوارد بمحضر جمع الاستدلالات.</li>
              <li><strong>رابعاً:</strong> القصور الواضح في محضر التحريات وعدم جديتها واعتمادها على مصادر مجهولة ومبهمة لا تصلح لإدانة متهم.</li>
            </ul>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold;">بناء عليه:</p>
              <p style="font-weight: bold; color: #b45309;">نلتمس أصلياً البراءة التامة لصالح موكلنا ورفض الدعوى المدنية التبعية وإلزام رافعها بالمصاريف القانونية ومقابل أتعاب المحاماة الفعلية.</p>
            </div>
          `;
        } else if (file.category === 'صحف الدعاوى') {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">صحيفة افتتاح دعوى قضائية</h4>
            <p>إنه في يوم الموافق / / بناء على طلب السيد الموكل المقيم في القاهرة وموطنه المختار مكتب الأستاذ أبو رميح للمحاماة، أنا محضر محكمة قد انتقلت وأعلنت السيد المدعى عليه المقيم في العنوان الموضح بملف الدعوى مخاطباً معه:</p>
            <div style="border-right: 3px solid #b45309; padding-right: 15px; margin: 15px 0;">
              <strong>الموضوع:</strong>
              <p>يطالب الطالب بموجب هذه الصحيفة الحكم بإلزام المعلن إليه بأداء كافة الالتزامات التعاقدية والتعويضات الجبرية الناتجة عن الإخلال ببنود الاتفاق المبرم بينهما والمؤرخ في تاريخ الواقعة، وذلك نظراً لثبوت الضرر المادي والأدبي البالغ الواقع على الطالب جراء هذا الامتناع غير المبرر.</p>
            </div>
            <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 20px;">
              <p style="font-weight: bold;">بناء عليه:</p>
              <p>أنا المحضر سالف الذكر قد انتقلت وأعلنت المعلن إليه بصورة من هذه العريضة وكلفته بالحضور أمام محكمة القضاء المختصة بجلستها المقامة في الميعاد المحدد لسماع الحكم بطلبات المدعي كاملة المصاريف والرسوم ومقابل الأتعاب المحددة بنظام المؤسسة.</p>
            </div>
          `;
        } else {
          bodyHtml = `
            <h4 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px;">مستند رسمي ومرفق قانوني</h4>
            <p>يقر مكتب الأستاذ أبو رميح للمحاماة والاستشارات القانونية بصحة وإرفاق هذا المستند المودع بالملف الإلكتروني والمسجل تحت مسمى <strong>"${file.name}"</strong> المصنف كوثيقة من نوع <strong>"${file.category}"</strong>.</p>
            <p>تم فحص هذا المستند ومطابقته لأصل الملف القانوني بمعرفة المحامي المكلف والمرافع أمام الدائرة القضائية المختصة، ويعد المستند جزءاً لا يتجزأ من ملف الدفاع وأدلة الإثبات المعتمدة في تداول الجلسات والطعون والاستئنافات المقررة لهذه القضية.</p>
          `;
        }

        newWin.document.write(`
          <html dir="rtl">
            <head>
              <title>${file.name} - عارض المستندات السريع</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body {
                  font-family: 'Cairo', sans-serif;
                  background-color: #f8fafc;
                  color: #1e293b;
                  padding: 40px;
                  margin: 0;
                  direction: rtl;
                  text-align: right;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                  border: 1px solid #e2e8f0;
                  min-height: 600px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #b45309;
                  padding-bottom: 15px;
                  margin-bottom: 30px;
                  font-size: 12px;
                  color: #475569;
                }
                .footer {
                  border-top: 1px solid #e2e8f0;
                  padding-top: 20px;
                  margin-top: 40px;
                  display: flex;
                  justify-content: space-between;
                  font-size: 11px;
                  color: #64748b;
                }
                .btn-print {
                  background-color: #b45309;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 6px;
                  font-family: 'Cairo', sans-serif;
                  font-weight: bold;
                  cursor: pointer;
                  margin-bottom: 20px;
                }
                .btn-print:hover {
                  background-color: #92400e;
                }
                @media print {
                  body { background: white; padding: 0; }
                  .container { box-shadow: none; border: none; padding: 0; }
                  .btn-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div style="text-align: left; max-width: 800px; margin: 0 auto;">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة المستند</button>
              </div>
              <div class="container">
                <div>
                  <div class="header">
                    <div>
                      <strong>مؤسسة رميح للمحاماة والاستشارات القانونية</strong><br/>
                      <span>تأسيس وخبرة قانونية عريقة</span>
                    </div>
                    <div style="text-align: left;">
                      <span>تاريخ الرفع: ${file.uploadDate}</span><br/>
                      <span>الرافع: ${file.uploadedBy || 'المكتب الرئيسي'}</span>
                    </div>
                  </div>
                  <div style="line-height: 1.8; font-size: 14px;">
                    ${bodyHtml}
                  </div>
                </div>
                <div class="footer">
                  <div>بوابة الإدارة الرقمية المتكاملة لمؤسسة رميح القانونية © 2026</div>
                  <div style="font-weight: bold; color: #e11d48;">مستند معتمد إلكترونياً</div>
                </div>
              </div>
            </body>
          </html>
        `);
        newWin.document.close();
      } else {
        alert('⚠️ الرجاء السماح بفتح النوافذ المنبثقة لرؤية المستند.');
      }
      return;
    }

    // 3. For public/online URLs (e.g. PDFs, Images, etc.)
    const absoluteFileUrl = fileUrl.startsWith('http') 
      ? fileUrl 
      : `${window.location.origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;

    let targetUrl = '';
    if (file.type === 'image') {
      targetUrl = absoluteFileUrl; // Direct image URL opens beautifully and natively in browser
    } else if (file.type === 'pdf') {
      targetUrl = `/pdf-viewer.html?file=${encodeURIComponent(finalFileUrl)}&title=${encodeURIComponent(file.name)}&fileId=${file.id || ''}`;
    } else {
      // PDF or general document: Open with official Google Docs Viewer
      targetUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteFileUrl)}&hl=ar`;
    }

    const newWin = window.open(targetUrl, '_blank', 'width=1100,height=850,scrollbars=yes,status=yes,resizable=yes');
    if (newWin) {
      newWin.focus();
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  // Direct print of sequential case documents/attachments (المستندات والأوراق المرفقة بالكامل)
  const handlePrintCaseSheet = (c: Case) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة المرفقات.');
      return;
    }

    getPdfWorkerBlobUrl().then((workerUrl) => {
      const sortedFiles = c.files && c.files.length > 0
        ? [...c.files].sort((a, b) => a.uploadDate.localeCompare(b.uploadDate))
        : [];

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>دفتر مستندات ومرفقات قضية رقم ${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}</title>
          <script src="/pdf.min.js"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
            
            @page {
              size: A4;
              margin: 15mm;
            }
            
            body {
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              text-align: right;
              background-color: #fff;
              color: #1e293b;
              margin: 0;
              padding: 0;
            }

            .cover-page {
              height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              border: 10px double #b45309;
              margin: 30px;
              padding: 40px;
              box-sizing: border-box;
              page-break-after: always;
            }
            .cover-title {
              font-size: 26px;
              font-weight: 800;
              color: #1e293b;
              margin-bottom: 5px;
            }
            .cover-subtitle {
              font-size: 14px;
              color: #b45309;
              font-weight: 700;
              margin-bottom: 40px;
            }
            .cover-badge {
              font-size: 18px;
              font-weight: 800;
              background-color: #fffbeb;
              border: 2px solid #b45309;
              padding: 10px 30px;
              border-radius: 8px;
              color: #78350f;
              margin-bottom: 40px;
            }
            .cover-meta-table {
              width: 80%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .cover-meta-table td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              font-size: 13px;
            }
            .cover-meta-table td.label {
              font-weight: bold;
              background-color: #f8fafc;
              width: 30%;
            }

            .doc-page {
              padding: 40px;
              min-height: 100vh;
              box-sizing: border-box;
              page-break-after: always;
              position: relative;
            }
            .doc-header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #b45309;
              padding-bottom: 10px;
              margin-bottom: 30px;
              font-size: 10px;
              color: #64748b;
            }
            .doc-header strong {
              color: #b45309;
            }
            .doc-title-box {
              text-align: center;
              margin-bottom: 25px;
            }
            .doc-title {
              font-size: 16px;
              font-weight: 800;
              color: #1e293b;
            }
            .doc-meta {
              font-size: 11px;
              color: #475569;
              margin-top: 5px;
            }
            .doc-body-container {
              border: 1px solid #cbd5e1;
              border-radius: 12px;
              padding: 25px;
              min-height: 60vh;
              background-color: #fafafa;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .doc-image {
              max-width: 100%;
              max-height: 55vh;
              object-fit: contain;
              display: block;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
            }
            .doc-placeholder-text {
              text-align: justify;
              line-height: 1.8;
              font-size: 13px;
              color: #334155;
            }
            .doc-footer-stamp {
              display: flex;
              justify-content: flex-end;
              margin-top: 30px;
            }
            .stamp-badge {
              border: 2px solid #b91c1c;
              color: #b91c1c;
              font-weight: 800;
              font-size: 11px;
              padding: 6px 15px;
              border-radius: 4px;
              transform: rotate(-4deg);
            }

            .print-btn-float {
              position: fixed;
              bottom: 20px;
              left: 20px;
              background-color: #b45309;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 8px;
              font-family: 'Cairo', sans-serif;
              font-size: 12px;
              font-weight: bold;
              cursor: pointer;
              box-shadow: 0 4px 10px rgba(0,0,0,0.15);
              z-index: 9999;
            }
            @media print {
              .print-btn-float {
                display: none !important;
              }
              .pdf-print-assistant {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-btn-float" onclick="window.print()">🖨️ طباعة الأوراق والمستندات الآن</button>

          <!-- 1. COVER PAGE OF ATTACHMENTS BOOK -->
          <div class="cover-page">
            <h1 class="cover-title">مؤسسة رميح لأعمال المحاماة</h1>
            <p class="cover-subtitle">والاستشارات القانونية والمرافعات الجنائية والمدنية والادارية</p>
            
            <div class="cover-badge">دفتر المستندات وحوافظ المرفقات الرسمية (ملف القضية بالكامل)</div>

            <table class="cover-meta-table">
              <tr>
                <td class="label">القضية رقم</td>
                <td><strong>${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance} (${c.type})</strong></td>
              </tr>
              <tr>
                <td class="label">الموكلين</td>
                <td><strong>${c.clientsList && c.clientsList.length > 0 ? c.clientsList.map(cl => `${cl.name} (${cl.role || 'موكل'})`).join(' - ') : c.clientName}</strong></td>
              </tr>
              <tr>
                <td class="label">الخصوم</td>
                <td><strong>${c.opponentsList && c.opponentsList.length > 0 ? c.opponentsList.map(opp => `${opp.name} (${opp.role})`).join(' - ') : `${c.opponent.name} (${c.opponent.role})`}</strong></td>
              </tr>
              <tr>
                <td class="label">جهة المحكمة</td>
                <td>${c.court} - الدائرة: ${c.circuit}</td>
              </tr>
              <tr>
                <td class="label">إجمالي المرفقات والأوراق المطبوعة</td>
                <td><strong>${sortedFiles.length} وثيقة ومستند قانوني ملحق</strong></td>
              </tr>
              <tr>
                <td class="label">تاريخ الاستخراج</td>
                <td>${new Date().toISOString().split('T')[0]}</td>
              </tr>
            </table>
          </div>

          <!-- 2. SEQUENTIAL ATTACHMENTS PAGES -->
          ${sortedFiles.length === 0 ? `
            <div class="doc-page">
              <div class="doc-header">
                <span>مؤسسة رميح للمحاماة - إفادة رسمية</span>
                <span>رقم الملف: <strong>${c.caseNumberFirstInstance}/${c.caseYearFirstInstance}</strong></span>
              </div>
              <div class="doc-body-container" style="text-align: center;">
                <p style="font-size: 16px; font-weight: bold; color: #78350f;">⚠️ لا توجد مرفقات أو مستندات مؤرشفة</p>
                <p style="font-size: 13px; color: #475569; max-width: 500px; margin: 15px auto; line-height: 1.8;">
                  يقر مكتب الأستاذ رميح للمحاماة والاستشارات القانونية بأنه لم يتم إرفاق أو رفع أي مستندات أو حوافظ أوراق داخل ملف هذه القضية الإلكتروني حتى تاريخه.
                </p>
              </div>
            </div>
          ` : sortedFiles.map((file, fileIdx) => {
            const isImage = file.type === 'image';
            const finalFileUrl = !file.fileUrl || file.fileUrl === '#'
              ? (file.type === 'pdf'
                  ? '/sample.pdf'
                  : file.type === 'image'
                    ? 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80'
                    : '/sample.pdf')
              : file.fileUrl;
            
            return `
              <div class="doc-page">
                <div class="doc-header">
                  <span>مؤسسة رميح للمحاماة - المرفق القضائي المعتمد</span>
                  <span>رقم الملف: <strong>${c.caseNumberFirstInstance}/${c.caseYearFirstInstance}</strong></span>
                </div>

                <div class="doc-title-box">
                  <h2 class="doc-title">الوثيقة رقم (${fileIdx + 1}): ${file.name}</h2>
                  <p class="doc-meta">التصنيف: ${file.category} | صيغة الملف: ${file.type.toUpperCase()} | تاريخ الإرفاق: ${file.uploadDate} | الحجم: ${file.size}</p>
                </div>

                <div class="doc-body-container">
                  ${finalFileUrl && file.type !== 'word' ? `
                    ${isImage ? `
                      <img src="${finalFileUrl}" class="doc-image" alt="${file.name}" style="max-width: 100%; max-height: 70vh; object-fit: contain; margin: 0 auto; display: block;" />
                    ` : `
                      <div class="pdf-print-assistant" style="margin-bottom: 20px; padding: 15px; background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; text-align: center;">
                        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #78350f;">📄 ملف بي دي اف مدمج: ${file.name}</p>
                        <p style="margin: 0 0 15px 0; font-size: 11px; color: #451a03; line-height: 1.6;">
                          ملاحظة: لطباعة هذا المستند المرفق بجودة كاملة وبشكل مستقل، يرجى الضغط على الزر أدناه:
                        </p>
                        <button onclick="printIframePdf('pdf-frame-${fileIdx}')" style="background-color: #b45309; color: white; border: none; padding: 6px 15px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer; font-family: 'Cairo', sans-serif;">
                          🖨️ طباعة ملف الـ PDF هذا الآن
                        </button>
                      </div>
                      <div class="pdf-render-container" data-pdf-url="${finalFileUrl}" id="pdf-container-${fileIdx}">
                        <div class="pdf-loading" id="pdf-loading-${fileIdx}" style="padding: 20px; text-align: center; font-weight: bold; color: #475569;">
                          ⏳ جاري تحميل ودمج صفحات مستند الـ PDF للطباعة...
                        </div>
                      </div>
                      <div class="iframe-container" style="width: 100%; height: 75vh; border: 1px solid #cbd5e1; overflow: hidden; display: none; justify-content: center; align-items: center; border-radius: 8px; background: #f8fafc;" id="pdf-iframe-fallback-${fileIdx}">
                        <iframe id="pdf-frame-${fileIdx}" src="${finalFileUrl}" style="width: 100%; height: 100%; border: none;" scrolling="no"></iframe>
                      </div>
                    `}
                  ` : `
                    <div class="doc-placeholder-text">
                      <p style="font-weight: bold; font-size: 15px; color: #78350f; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
                        📄 معاينة محتوى الوثيقة الرسمية المسجلة:
                      </p>
                      
                      ${file.category === 'أحكام' ? `
                        <p>بناء على ما تداولته الجلسات القضائية العلنية المسجلة بالدائرة المختصة بمحكمة ${c.court}، نرفق لسيادتكم الحكم الصادر في النزاع القانوني القائم لصالح موكل مكتبنا الأستاذ عربي رميح.</p>
                        <p style="font-weight: 600; padding: 15px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #1e293b; margin-top: 15px;">
                          وقررت المحكمة حكمها النهائي: قبول الدعوى شكلاً وموضوعاً، وبإلزام المدعى عليه بالوفاء بالحقوق وتأدية المصاريف المترتبة على ذلك قانوناً.
                        </p>
                      ` : file.category === 'مذكرات' ? `
                        <p>نرفق لسيادتكم مذكرة الدفاع القانونية المستندة لأقوى الدفوع الشكلية والموضوعية المقدمة من مكتبنا بصفتنا وكلاء رسميين عن الموكل ${c.clientName}.</p>
                        <ul style="padding-right: 20px; space-y: 10px; font-size: 12px; color: #334155; margin-top: 15px;">
                          <li>الدفع بانتفاء الدليل والقرينة القانونية بحق المتهم وسقوط الحق بمرور الزمن.</li>
                          <li>الدفع بعدم اختصاص المحكمة محلياً أو قيمياً بنظر الدعوى الحالية وفق نصوص المواد المقررة.</li>
                          <li>المطالبة ببراءة الموكل أصلياً ورفض الدعوى الفرعية لعدم استنادها لواقع ملموس.</li>
                        </ul>
                      ` : file.category === 'صحف الدعاوى' ? `
                        <p>نرفق صحيفة وعريضة افتتاحه القضية المقيدة والمودعة رسمياً بقلم كتاب محكمة ${c.court}، لإعلان الخصم ${c.opponent.name} بالمثول والرد على صحف الطلبات المدونة بالعريضة.</p>
                      ` : `
                        <p>يقر مكتب الأستاذ رميح للمحاماة بصحة ونسب وإيداع هذا المستند الملحق المسمى "${file.name}" كجزء لا يتجزأ من ملف الدفاع العام، للتدقيق والمطالعة بمرحلة التقاضي الجارية.</p>
                      `}
                    </div>
                  `}
                </div>

                <div class="doc-footer-stamp">
                  <div class="stamp-badge">مؤسسة رميح للمحاماة - مستند مدمج ومعتمد</div>
                </div>
              </div>
            `;
          }).join('')}

          <script>
            function checkPdfLibLoaded() {
              if (typeof pdfjsLib !== 'undefined') {
                startPdfRender();
              } else {
                setTimeout(checkPdfLibLoaded, 50);
              }
            }

            async function startPdfRender() {
              try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '${workerUrl}';
                if (document.querySelectorAll('.pdf-render-container').length > 0) {
                  await renderAllPdfs();
                }
              } catch (e) {
                console.error("Bulk PDF render failed:", e);
              }
              // Wait 500ms for browser paint before opening print dialog
              setTimeout(() => {
                window.print();
              }, 500);
            }

            async function renderAllPdfs() {
              const containers = document.querySelectorAll('.pdf-render-container');
              for (const container of containers) {
                const url = container.getAttribute('data-pdf-url');
                const containerId = container.id;
                const fileIdx = containerId.split('-').pop();
                const loadingEl = document.getElementById('pdf-loading-' + fileIdx);
                const fallbackEl = document.getElementById('pdf-iframe-fallback-' + fileIdx);
                
                try {
                  if (typeof pdfjsLib === 'undefined') {
                    throw new Error('PDF.js library not loaded');
                  }
                  const loadingTask = pdfjsLib.getDocument(url);
                  const pdf = await loadingTask.promise;
                  if (loadingEl) loadingEl.style.display = 'none';
                  
                  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.5 });
                    
                    const canvas = document.createElement('canvas');
                    canvas.className = 'pdf-page-canvas';
                    canvas.style.maxWidth = '100%';
                    canvas.style.height = 'auto';
                    canvas.style.display = 'block';
                    canvas.style.margin = '15px auto';
                    canvas.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
                    canvas.style.border = '1px solid #cbd5e1';
                    if (pageNum < pdf.numPages) {
                      canvas.style.pageBreakAfter = 'always';
                    }
                    
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    const renderContext = {
                      canvasContext: context,
                      viewport: viewport
                    };
                    await page.render(renderContext).promise;
                    container.appendChild(canvas);
                  }
                } catch (error) {
                  console.error('Error rendering PDF:', error);
                  if (loadingEl) {
                    loadingEl.innerHTML = '⚠️ تعذر دمج صفحات الملف للطباعة تلقائياً بسبب قيود الحماية. تم تفعيل العرض البديل بالأسفل.';
                    loadingEl.style.color = '#ef4444';
                  }
                  if (fallbackEl) {
                    fallbackEl.style.display = 'flex';
                  }
                }
              }
            }

            function printIframePdf(frameId) {
              const frame = document.getElementById(frameId);
              if (frame) {
                try {
                  frame.contentWindow.focus();
                  frame.contentWindow.print();
                } catch (e) {
                  alert('يرجى النقر داخل وثيقة الـ PDF المضمنة ثم الضغط على Ctrl+P للطباعة نظراً لقيود حماية المتصفح.');
                }
              }
            }

            if (document.readyState === 'complete' || document.readyState === 'interactive') {
              checkPdfLibLoaded();
            } else {
              window.onload = checkPdfLibLoaded;
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    });
  };


  // Direct print of a beautifully detailed PDF Report (containing Case details, what happened, and parties)
  const handlePrintDetailedReport = (c: Case) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.');
      return;
    }

    const matchedClient = clients.find(cl => cl.id === c.clientId || cl.name === c.clientName);
    const assignedLawyer = users.find(u => u.id === c.assignedLawyerId);
    const caseSessions = [...sessions.filter(s => s.caseId === c.id)].sort((a, b) => a.date.localeCompare(b.date));
    const previousDecisions = caseSessions.filter(s => s.decision && s.decision.trim() !== '');
    
    const formattedDate = new Date().toISOString().split('T')[0];
    const generatedBy = currentUser.fullName;

    const openingDate = c.files && c.files.length > 0 
      ? c.files.sort((a,b) => a.uploadDate.localeCompare(b.uploadDate))[0].uploadDate 
      : `01-01-${c.caseYearFirstInstance || '2026'}`;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>تقرير قضية رقم ${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
            
            @page {
              size: A4;
              margin: 12mm 15mm 15mm 15mm;
            }
            
            body {
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              text-align: right;
              background-color: #fff;
              color: #1e293b;
              margin: 0;
              padding: 0;
              line-height: 1.6;
              font-size: 11px;
              position: relative;
            }

            /* Watermark background */
            body::before {
              content: "";
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-15deg);
              width: 320px;
              height: 320px;
              background-image: url('/icon-192.png');
              background-repeat: no-repeat;
              background-position: center;
              background-size: contain;
              opacity: 0.04;
              pointer-events: none;
              z-index: -1000;
            }
            
            .report-container {
              padding: 0px;
            }

            /* Header and Institution Identity */
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              border-bottom: 2px solid #b45309;
            }
            .header-cell {
              vertical-align: middle;
              padding-bottom: 12px;
            }
            .brand-title {
              font-size: 18px;
              font-weight: 900;
              color: #1e293b;
              margin: 0;
            }
            .brand-subtitle {
              font-size: 10px;
              color: #b45309;
              font-weight: 700;
              margin: 3px 0 0 0;
            }
            .doc-title-container {
              text-align: center;
              margin-bottom: 25px;
            }
            .doc-title-badge {
              display: inline-block;
              background-color: #fffbeb;
              border: 1.5px solid #d97706;
              color: #78350f;
              font-weight: 900;
              font-size: 13px;
              padding: 6px 24px;
              border-radius: 12px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            }

            /* Section headers */
            .section-title {
              font-size: 12px;
              font-weight: 800;
              color: #78350f;
              background-color: #fef3c7;
              border-right: 4px solid #b45309;
              padding: 6px 12px;
              margin-top: 22px;
              margin-bottom: 10px;
              border-radius: 0 4px 4px 0;
            }

            /* Grid Data Tables */
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .data-table th {
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              font-weight: 700;
              color: #334155;
              text-align: right;
              width: 20%;
              font-size: 10px;
            }
            .data-table td {
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              color: #0f172a;
              font-size: 11px;
            }
            .highlight-cell {
              font-weight: 700;
              color: #b45309;
            }

            /* Timeline & Previous hearings */
            .timeline-item {
              border-right: 3px solid #cbd5e1;
              padding-right: 18px;
              margin-right: 12px;
              margin-bottom: 12px;
              position: relative;
            }
            .timeline-item::before {
              content: "";
              position: absolute;
              right: -7px;
              top: 4px;
              width: 11px;
              height: 11px;
              background-color: #d97706;
              border: 2px solid #fff;
              border-radius: 50%;
              box-shadow: 0 0 0 2px #d97706;
            }
            .timeline-date {
              font-family: monospace;
              font-weight: bold;
              color: #b45309;
              font-size: 10.5px;
            }
            .timeline-content {
              margin-top: 4px;
              color: #334155;
              font-size: 11px;
              line-height: 1.5;
            }

            /* Stamp and signatures section */
            .signature-stamp-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 35px;
              page-break-inside: avoid;
            }
            .stamp-cell {
              text-align: center;
              vertical-align: middle;
              width: 40%;
            }
            .signature-cell {
              text-align: right;
              vertical-align: top;
              width: 30%;
              font-size: 11px;
              color: #334155;
            }
            .stamp-outer {
              display: inline-block;
              width: 95px;
              height: 95px;
              border: 3px double #b45309;
              border-radius: 50%;
              padding: 3px;
              position: relative;
              transform: rotate(-5deg);
              opacity: 0.85;
            }
            .stamp-inner {
              width: 100%;
              height: 100%;
              border: 1px dashed #b45309;
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #b45309;
              font-size: 8px;
              font-weight: bold;
              line-height: 1.2;
            }
            .stamp-scale {
              font-size: 18px;
              margin-bottom: 2px;
            }

            /* Footer metadata styling */
            .report-footer {
              margin-top: 45px;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              color: #64748b;
              page-break-inside: avoid;
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
              font-size: 12px;
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
              box-shadow: 0 6px 20px rgba(180,83,9,0.35);
            }
            @media print {
              .print-btn-float {
                display: none !important;
              }
              body {
                margin: 0;
                padding: 0;
              }
              body::before {
                opacity: 0.035; /* safe opacity for printing */
              }
            }
          </style>
        </head>
        <body>
          <button class="print-btn-float" onclick="window.print()">🖨️ طباعة التقرير الآن</button>
          
          <div class="report-container">
            <!-- HEADER -->
            <table class="header-table">
              <tr>
                <td class="header-cell" style="width: 35%; text-align: right;">
                  <h1 class="brand-title">مؤسسة رميح للمحاماة</h1>
                  <p class="brand-subtitle">والاستشارات القانونية وأعمال الطعن والتمثيل القضائي</p>
                  <p style="font-size: 8px; color: #64748b; margin: 2px 0 0 0;">تأسست عام ١٩٨٥ | هاتف: ٠١٠٠٢٢٢٠٠٠</p>
                </td>
                <td class="header-cell" style="width: 30%; text-align: center; vertical-align: middle;">
                  <div style="display: inline-block; position: relative;">
                    <img src="/icon-192.png" style="width: 64px; height: 64px; object-fit: contain;" onerror="this.style.display='none'; document.getElementById('alt-logo').style.display='flex';" />
                    <div id="alt-logo" class="brand-logo-sim" style="display: none; width: 64px; height: 64px; margin: 0 auto; border-radius: 12px; font-size: 32px; align-items: center; justify-content: center; background: linear-gradient(135deg, #b45309 0%, #78350f 100%); color: white;">⚖️</div>
                  </div>
                </td>
                <td class="header-cell" style="width: 35%; text-align: left; font-size: 9px; color: #475569; direction: ltr; line-height: 1.4;">
                  <strong>RUMEIH LAW FIRM</strong><br/>
                  Advocacy & Legal Consultations<br/>
                  Date: ${formattedDate}<br/>
                  File No: ${c.officeFileNo || 'R-' + c.caseNumberFirstInstance}
                </td>
              </tr>
            </table>

            <div class="doc-title-container">
              <span class="doc-title-badge">التقرير القانوني الشامل والتقرير القضائي للملف</span>
            </div>

            <!-- SECTION 1 -->
            <div class="section-title">أولاً: بيانات ومعرفات الدعوى والتقاضي</div>
            <table class="data-table">
              <tr>
                <th>رقم أول درجة</th>
                <td class="highlight-cell">${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}</td>
                <th>محكمة ودائرة أول درجة</th>
                <td>${c.courtFirstInstance || c.court || 'غير محدد'} - د/ ${c.circuitFirstInstance || c.circuit || 'غير محدد'} ${c.venueFirstInstance ? ' (' + c.venueFirstInstance + ')' : ''}</td>
              </tr>
              <tr>
                <th>رقم الاستئناف</th>
                <td>${c.caseNumberSecondInstance || 'غير مقيد'} ${c.caseYearSecondInstance ? 'لسنة ' + c.caseYearSecondInstance : ''}</td>
                <th>محكمة ودائرة الاستئناف</th>
                <td>${c.courtSecondInstance || 'غير مقيد'} ${c.circuitSecondInstance ? ' - د/ ' + c.circuitSecondInstance : ''} ${c.venueSecondInstance ? ' (' + c.venueSecondInstance + ')' : ''}</td>
              </tr>
              <tr>
                <th>رقم طعن النقض</th>
                <td>${c.cassationNumber || 'غير مقيد'} ${c.cassationYear ? 'لسنة ' + c.cassationYear : ''}</td>
                <th>محكمة ودائرة النقض</th>
                <td>${c.courtCassation || 'غير مقيد'} ${c.circuitCassation ? ' - د/ ' + c.circuitCassation : ''} ${c.venueCassation ? ' (' + c.venueCassation + ')' : ''}</td>
              </tr>
              <tr>
                <th>جهة المحكمة الحالية</th>
                <td class="highlight-cell">${c.court}</td>
                <th>الدائرة المختصة الحالية</th>
                <td class="highlight-cell">${c.circuit}</td>
              </tr>
              <tr>
                <th>درجة التقاضي</th>
                <td class="highlight-cell">${c.degree}</td>
                <th>نوع القضية</th>
                <td>${c.type}</td>
              </tr>
              <tr>
                <th>حالة القضية</th>
                <td><strong>${c.status}</strong></td>
                <th>تاريخ فتح الملف</th>
                <td>${openingDate}</td>
              </tr>
              <tr>
                <th>المحامي المسؤول</th>
                <td class="highlight-cell">${assignedLawyer?.fullName || 'غير معين'}</td>
                <th>عضو النيابة</th>
                <td>${c.prosecutorName || 'لا يوجد أو غير مدون'}</td>
              </tr>
              <tr>
                <th>رقم الحصر القضائي</th>
                <td colspan="3">${c.enforcementNumber || 'لا يوجد'}</td>
              </tr>
            </table>

            <!-- SECTION 2 -->
            <div class="section-title">ثانياً: أطراف الخصومة والنزاع القضائي</div>
            <table class="data-table">
              ${c.clientsList && c.clientsList.length > 0 ? c.clientsList.map((cl, clIdx) => `
                <tr>
                  <th style="background-color: #ecfdf5;">اسم الموكل رقم ${clIdx + 1}</th>
                  <td colspan="3" class="highlight-cell" style="background-color: #f0fdf4;"><strong>${cl.name}</strong> ${cl.role ? `(${cl.role})` : ''}</td>
                </tr>
                <tr>
                  <th>بيانات الموكل الإضافية</th>
                  <td colspan="3">
                    الهاتف: ${cl.phone || 'غير مدون'} ${cl.email ? ` | البريد الإلكتروني: ${cl.email}` : ''}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <th style="background-color: #ecfdf5;">اسم الموكل (الطرف الأول)</th>
                  <td colspan="3" class="highlight-cell" style="background-color: #f0fdf4;">${c.clientName}</td>
                </tr>
                <tr>
                  <th>بيانات الموكل الإضافية</th>
                  <td colspan="3">
                    الهاتف: ${matchedClient?.phone || 'غير مدون'} 
                    ${matchedClient?.secondaryPhone ? ' - بديل: ' + matchedClient.secondaryPhone : ''} | 
                    الرقم القومي: ${matchedClient?.nationalId || 'غير مدون'} | 
                    العنوان: ${matchedClient?.address || 'غير مدون'} |
                    الوظيفة: ${matchedClient?.job || 'غير مدونة'}
                  </td>
                </tr>
              `}

              ${c.opponentsList && c.opponentsList.length > 0 ? c.opponentsList.map((opp, oppIdx) => `
                <tr>
                  <th style="background-color: #fef2f2;">اسم الخصم رقم ${oppIdx + 1}</th>
                  <td colspan="3" class="highlight-cell" style="background-color: #fdf2f2; color: #b91c1c;"><strong>${opp.name}</strong> (${opp.role})</td>
                </tr>
                <tr>
                  <th>بيانات الخصم والوكلاء</th>
                  <td colspan="3">
                    الهاتف: ${opp.phone || 'غير مدون'} | 
                    العنوان: ${opp.address || 'غير مدون'} | 
                    محامي الخصم: ${opp.lawyer || 'لا يوجد'} ${opp.lawyerPhone ? '(هاتف: ' + opp.lawyerPhone + ')' : ''}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <th style="background-color: #fef2f2;">اسم الخصم (الطرف الثاني)</th>
                  <td colspan="3" class="highlight-cell" style="background-color: #fdf2f2; color: #b91c1c;">${c.opponent.name} (${c.opponent.role})</td>
                </tr>
                <tr>
                  <th>بيانات الخصم والوكلاء</th>
                  <td colspan="3">
                    الهاتف: ${c.opponent.phone || 'غير مدون'} | 
                    العنوان: ${c.opponent.address || 'غير مدون'} | 
                    محامي الخصم: ${c.opponent.lawyer || 'لا يوجد'} ${c.opponent.lawyerPhone ? '(هاتف: ' + c.opponent.lawyerPhone + ')' : ''}
                  </td>
                </tr>
              `}
            </table>

            <!-- SECTION 3 -->
            <div class="section-title">ثالثاً: ملخص موضوع الدعوى والطلب</div>
            <div style="border: 1px solid #cbd5e1; padding: 12px; bg-color: #f8fafc; border-radius: 8px; text-align: justify; margin-bottom: 15px; font-size: 11px; line-height: 1.6; color: #334155;">
              ${c.notes || `هذه القضية مصنفة تحت نوع (${c.type})، ومقيدة أمام محكمة ${c.court} الدائرة ${c.circuit} دفاعاً عن حقوق الموكل ${c.clientName} ضد الخصم ${c.opponent.name}، وتجري متابعة مذكرات الدفاع والجلسات بانتظام بواسطة المحامي المكلف.`}
            </div>

            <!-- SECTION 4 -->
            <div class="section-title">رابعاً: السجل الزمني للإجراءات والقرارات التي تمت</div>
            ${caseSessions.length === 0 ? `
              <p style="color: #64748b; font-style: italic; text-align: center; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px;">لا توجد جلسات أو إجراءات سابقة مؤرشفة بالملف القضائي.</p>
            ` : caseSessions.map((sess, idx) => `
              <div class="timeline-item">
                <div class="timeline-date">الإجراء #${idx + 1} - تاريخ: ${sess.date} ${sess.time ? ' الساعة ' + sess.time : ''}</div>
                <div class="timeline-content">
                  <strong>موضوع الإجراء:</strong> ${sess.subject} <br/>
                  ${sess.decision ? `<strong>قرار المحكمة:</strong> <span style="color: #d97706; font-weight: bold;">${sess.decision}</span>` : `<span style="color: #64748b; font-style: italic;">بانتظار انعقاد الجلسة ورصد القرار</span>`}
                  ${sess.whatHappened ? `<br/><strong>تفاصيل ما تم:</strong> ${sess.whatHappened}` : ''}
                </div>
              </div>
            `).join('')}

            <!-- SECTION 5: EXPERT REFERRAL DETAILS -->
            ${(c.isReferredToExperts || c.expertReferral?.isReferred || (c.expertReferral && (c.expertReferral.expertOffice || c.expertReferral.expertName))) ? `
              <div class="section-title">خامساً: تفاصيل وبيانات إحالة القضية إلى خبراء وزارة العدل</div>
              <table class="data-table">
                <tr>
                  <th>مكتب الخبراء المختص</th>
                  <td class="highlight-cell">${c.expertReferral?.expertOffice || 'غير محدد'}</td>
                  <th>اسم الخبير المباشر</th>
                  <td class="highlight-cell">${c.expertReferral?.expertName || 'لم يحدد بعد'} ${c.expertReferral?.expertPhone ? '(' + c.expertReferral.expertPhone + ')' : ''}</td>
                </tr>
                <tr>
                  <th>رقم ملف الخبراء</th>
                  <td style="font-family: monospace; font-weight: bold; color: #b45309;">${c.expertReferral?.fileNumber || 'غير مدون'}</td>
                  <th>تاريخ قرار الإحالة</th>
                  <td>${c.expertReferral?.referralDate || 'غير مدون'}</td>
                </tr>
                <tr>
                  <th>حالة ملف الخبراء</th>
                  <td style="font-weight: bold; color: #0284c7;">${c.expertReferral?.status || 'قيد المباشرة'}</td>
                  <th>تاريخ العودة للمحكمة</th>
                  <td>${c.expertReferral?.returnedToCourtAt || 'قيد المباشرة لدى الخبراء'}</td>
                </tr>
                ${c.expertReferral?.referralReason ? `
                  <tr>
                    <th>سبب وتفاصيل الإحالة</th>
                    <td colspan="3">${c.expertReferral.referralReason}</td>
                  </tr>
                ` : ''}
              </table>

              ${c.expertReferral?.sessions && c.expertReferral.sessions.length > 0 ? `
                <div style="font-weight: bold; color: #78350f; margin-top: 10px; margin-bottom: 5px; font-size: 11px;">📅 جلسات ومواعيد المباشرة بالخبراء (${c.expertReferral.sessions.length}):</div>
                <table class="data-table">
                  <thead>
                    <tr style="background-color: #fef3c7;">
                      <th style="width: 20%; text-align: right;">تاريخ الجلسة</th>
                      <th style="width: 20%; text-align: right;">نوع الجلسة</th>
                      <th style="width: 20%; text-align: right;">المكان</th>
                      <th style="text-align: right;">ما تم بالجلسة والإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${c.expertReferral.sessions.map(es => `
                      <tr>
                        <td style="font-family: monospace; font-weight: bold; color: #b45309;">${es.date} ${es.time ? '(' + es.time + ')' : ''}</td>
                        <td>${es.sessionType}</td>
                        <td>${es.location || 'مكتب الخبير'}</td>
                        <td style="font-weight: 600;">${es.decisionOrAction || 'تم الحضور والمتابعة'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : ''}

              ${c.expertReferral?.documents && c.expertReferral.documents.length > 0 ? `
                <div style="font-weight: bold; color: #78350f; margin-top: 10px; margin-bottom: 5px; font-size: 11px;">📂 المستندات والمذكرات المودعة لدى الخبير (${c.expertReferral.documents.length}):</div>
                <table class="data-table">
                  <thead>
                    <tr style="background-color: #fef3c7;">
                      <th style="width: 45%; text-align: right;">اسم المستند</th>
                      <th style="width: 25%; text-align: right;">تاريخ الإيداع</th>
                      <th style="text-align: right;">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${c.expertReferral.documents.map(ed => `
                      <tr>
                        <td style="font-weight: 600;">📄 ${ed.title}</td>
                        <td style="font-family: monospace;">${ed.submissionDate}</td>
                        <td>${ed.notes || ed.submittedBy || 'مكتمل'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : ''}

              ${c.expertReferral?.report && c.expertReferral.report.summary ? `
                <div style="border: 1px solid #fcd34d; background-color: #fffbeb; padding: 10px; border-radius: 8px; margin-top: 10px; margin-bottom: 12px;">
                  <div style="font-weight: 900; color: #78350f; font-size: 11px; margin-bottom: 4px;">📊 ملخص ونتيجة تقرير الخبير النهائي:</div>
                  <div style="color: #1e293b; font-size: 11px; line-height: 1.5;">${c.expertReferral.report.summary}</div>
                  ${c.expertReferral.report.resultStatus ? `<div style="font-weight: bold; color: #059669; font-size: 10px; margin-top: 4px;">موقف النتيجة: ${c.expertReferral.report.resultStatus}</div>` : ''}
                </div>
              ` : ''}
            ` : ''}

            <!-- SECTION 6 -->
            <div class="section-title">سادساً: قرارات الهيئة القضائية المعتمدة السابقة</div>
            ${previousDecisions.length === 0 ? `
              <p style="color: #64748b; font-style: italic; text-align: center; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px;">لم تسجل مخرجات قرارات في السجل حتى تاريخه.</p>
            ` : `
              <table class="data-table">
                <tr style="background-color: #f1f5f9;">
                  <th style="width: 20%; text-align: right;">تاريخ الجلسة</th>
                  <th style="text-align: right;">القرار الصادر المعتمد بمحضر الجلسة</th>
                </tr>
                ${previousDecisions.map(d => `
                  <tr>
                    <td style="font-family: monospace; font-weight: bold; color: #b45309;">${d.date}</td>
                    <td style="font-weight: 600; color: #1e293b;">${d.decision}</td>
                  </tr>
                `).join('')}
              </table>
            `}

            <!-- SECTION 7: Saved Documents and Attachments -->
            <div class="section-title">سابعاً: المرفقات والمستندات المودعة بالملف القضائي</div>
            ${!c.files || c.files.length === 0 ? `
              <p style="color: #64748b; font-style: italic; text-align: center; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 6px; margin-bottom: 12px;">لا توجد مستندات أو مرفقات مؤرشفة بالملف حتى تاريخه.</p>
            ` : `
              <table class="data-table">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th style="text-align: right; width: 35%;">اسم المستند ومرفقات القضية</th>
                    <th style="text-align: right; width: 20%;">نوع المستند / التصنيف</th>
                    <th style="text-align: right; width: 15%;">تاريخ الإيداع</th>
                    <th style="text-align: right; width: 15%;">الحجم</th>
                    <th style="text-align: right; width: 15%;">بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  ${c.files.map(f => `
                    <tr>
                      <td style="font-weight: 600; color: #1e293b;">📄 ${f.name}</td>
                      <td><span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #475569; border: 1px solid #e2e8f0;">${f.category || f.type || 'مستند قانوني'}</span></td>
                      <td style="font-family: monospace; font-size: 10px; color: #64748b;">${f.uploadDate}</td>
                      <td style="font-family: monospace; font-size: 10px; color: #64748b;">${f.size}</td>
                      <td style="color: #475569;">${f.uploadedBy || 'مكتب المحاماة'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}

            <!-- SECTION 8 -->
            <div class="section-title">ثامناً: الجلسة القادمة وتفاصيل التنفيذ والرسوم المالية</div>
            <table class="data-table">
              <tr>
                <th style="background-color: #fffbeb;">تاريخ الجلسة القادمة</th>
                <td class="highlight-cell" style="background-color: #fffdf5; font-size: 11px;">
                  ${c.nextHearingDate ? `📅 ${c.nextHearingDate} ${c.nextHearingTime ? 'الساعة ' + c.nextHearingTime : ''}` : '❌ لم تحدد بعد'}
                </td>
                <th>حالة التنفيذ والتعويض</th>
                <td class="highlight-cell">${c.enforcementNumber ? `محضر رقم ${c.enforcementNumber}` : 'بانتظار الحكم'}</td>
              </tr>
              <tr>
                <th>إجمالي الأتعاب المقررة</th>
                <td style="font-weight: bold; color: #0284c7;">${c.totalFees.toLocaleString()} ج.م</td>
                <th>المبلغ المسدد المقبوض</th>
                <td style="font-weight: bold; color: #16a34a;">${c.paidFees.toLocaleString()} ج.م</td>
              </tr>
              <tr>
                <th>المبلغ المتبقي المستحق المطلوب سداده</th>
                <td colspan="3" style="font-size: 11px; font-weight: 800; color: #dc2626;">
                  ${c.remainingFees.toLocaleString()} ج.م (فقط لا غير)
                </td>
              </tr>
            </table>

            <!-- STAMP & SIGNATURES -->
            <table class="signature-stamp-table">
              <tr>
                <td class="signature-cell">
                  <strong>توقيع المحامي المسؤول:</strong><br/>
                  <span style="font-size: 10px; color: #64748b; display: block; margin-top: 5px;">الأستاذ/ ${assignedLawyer?.fullName || 'عربي رميح'}</span>
                  <div style="margin-top: 35px; border-bottom: 1px dotted #94a3b8; width: 140px; height: 1px;"></div>
                </td>
                <td class="stamp-cell">
                  <div class="stamp-outer">
                    <div class="stamp-inner">
                      <span class="stamp-scale">⚖️</span>
                      <span>مؤسسة رميح للمحاماة</span>
                      <span>معتمد ورسمي</span>
                    </div>
                  </div>
                </td>
                <td class="signature-cell" style="text-align: left;">
                  <strong>اعتماد الإدارة العليا للمكتب:</strong><br/>
                  <span style="font-size: 10px; color: #64748b; display: block; margin-top: 5px;">توقيع المدير العام المسؤول</span>
                  <div style="margin-top: 35px; border-bottom: 1px dotted #94a3b8; width: 140px; height: 1px; display: inline-block;"></div>
                </td>
              </tr>
            </table>

            <!-- FOOTER INFO -->
            <div class="report-footer">
              <div>تاريخ إصدار المستند: ${formattedDate}</div>
              <div>المستخدم المسؤول: ${generatedBy}</div>
              <div>بوابة المحاماة الذكية - مؤسسة رميح لأعمال المحاماة © 2026</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Send Report text summary to client via WhatsApp
  const handleSendReportWhatsApp = (c: Case) => {
    const matchedClient = clients.find(cl => cl.id === c.clientId || cl.name === c.clientName);
    
    if (!matchedClient || !matchedClient.phone || !matchedClient.phone.trim()) {
      alert(`⚠️ لا يمكن إتمام الإرسال:
عذرًا، لم يتم العثور على رقم هاتف مسجل للموكل (${c.clientName}) في قاعدة البيانات للاتصال به عبر الواتساب.`);
      return;
    }

    const clientPhone = matchedClient.phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
    const cleanPhone = clientPhone.startsWith('+') ? clientPhone : `+20${clientPhone.replace(/^0+/, '')}`; // Default to Egypt +20

    const formattedDate = new Date().toISOString().split('T')[0];
    const messageText = `السلام عليكم ورحمة الله وبركاته،
عناية السيد الموكل/ة: *${c.clientName}* المحترم،

مرفق لسيادتكم ملخص التقرير القانوني الشامل والخاص بملف قضيتكم لدى مؤسسة رميح لأعمال المحاماة والاستشارات القانونية:

*تفاصيل ومعرفات القضية:*
- رقم القضية: ${c.caseNumberFirstInstance} لسنة ${c.caseYearFirstInstance}
- المحكمة: ${c.court}
- الدائرة المختصة: ${c.circuit}
- درجة التقاضي الحالية: ${c.degree}
- حالة ملف الدعوى: ${c.status}

*الموقف القضائي والجلسات:*
- الجلسة القادمة المقررة: ${c.nextHearingDate ? c.nextHearingDate : 'لم تحدد بعد'}
- إجمالي الأتعاب المتفق عليها: ${c.totalFees.toLocaleString()} ج.م
- إجمالي المبالغ المسددة: ${c.paidFees.toLocaleString()} ج.م
- المبلغ المتبقي المستحق: ${c.remainingFees.toLocaleString()} ج.م

مرفق طيه ملف التقرير القضائي بصيغة (PDF) المعتمدة من نظام الأرشفة لسيادتكم للاطلاع والمتابعة الفورية.

للاستفسار، يسعدنا تواصلكم الدائم مع مكتبنا.
مؤسسة رميح لأعمال المحاماة والاستشارات القانونية
تاريخ التقرير: ${formattedDate}`;

    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');
    alert(`📱 تم إعداد الرسالة المخصصة بنجاح!
سيتم الآن فتح تطبيق WhatsApp Web أو تطبيق الواتساب لإرسال التقرير والرسالة التعريفية تلقائياً للموكل (${matchedClient.name}) على الرقم: ${matchedClient.phone}`);
  };
  

  return (
    <div className="space-y-3.5">
      
      {returnToClient && (
        <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl text-right animate-fadeIn" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Users className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">أنت تستعرض ملفات مرتبطة بالموكل: {returnToClient.name}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold">يمكنك العودة إلى صفحة الموكل وتفاصيله الكاملة مباشرة في أي وقت.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (onSetSelectedClientIdForReturn) {
                  onSetSelectedClientIdForReturn(returnToClient.id);
                }
                if (onNavigateToTab) {
                  onNavigateToTab('clients');
                }
                if (onSetReturnToClient) {
                  onSetReturnToClient(null);
                }
              }}
              className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
              الرجوع إلى صفحة الموكل
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
      
      {/* Sub tabs: Cases or Companies */}
      <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 self-start inline-flex shadow-lg shadow-black/10">
        <button
          onClick={() => {
            setActiveSubTab('cases');
            setSearchQuery('');
          }}
          className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 flex items-center gap-2 ${activeSubTab === 'cases' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Scale className="w-4 h-4" />
          جدول القضايا والدعاوى ({activeCases.length})
        </button>
        <button
          onClick={() => {
            setActiveSubTab('companies');
            setSearchQuery('');
          }}
          className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 flex items-center gap-2 ${activeSubTab === 'companies' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Building2 className="w-4 h-4" />
          سجل الشركات والمؤسسات ({activeCompanies.length})
        </button>
      </div>

      {activeSubTab === 'cases' ? (
        <>
          {/* Search and Action Bar */}
          <div className="bg-gradient-to-b from-slate-50 to-white border-t-4 border-t-amber-500 border border-slate-200 rounded-2xl p-5 shadow-sm animate-fadeIn">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              
              {/* Smart Search */}
              <div className="relative flex-1">
                <span className="absolute right-3.5 top-3.5 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="البحث الذكي بواسطة: الموكل، رقم القضية، سنة القضية، المحكمة، الخصم أو نوع النزاع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-11 py-2.5 bg-slate-100/60 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all font-sans"
                />
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={selectedTypeFilter}
                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                    className="bg-slate-100/60 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all font-semibold text-slate-700 cursor-pointer appearance-none pr-8 pl-3"
                  >
                    <option value="الكل">جميع الأنواع ⚖️</option>
                    <option value="جنائي">جنائي</option>
                    <option value="جنح">جنح</option>
                    <option value="ادارى">ادارى</option>
                    <option value="مدني">مدني</option>
                    <option value="إيجارات">إيجارات</option>
                    <option value="أحوال شخصية">أحوال شخصية</option>
                    <option value="صحة توقيع">صحة توقيع</option>
                    {allCaseTypes.filter(t => !['جنائي','جنح','ادارى','مدني','إيجارات','أحوال شخصية','صحة توقيع'].includes(t as string)).map(t => (
                      <option key={t as string} value={t as string}>{t as string}</option>
                    ))}
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">▼</span>
                </div>

                <div className="relative">
                  <select
                    value={selectedDegreeFilter}
                    onChange={(e) => setSelectedDegreeFilter(e.target.value)}
                    className="bg-slate-100/60 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all font-semibold text-slate-700 cursor-pointer appearance-none pr-8 pl-3"
                  >
                    <option value="الكل">كل الدرجات 🏛️</option>
                    <option value="أول درجة">أول درجة</option>
                    <option value="استئناف">استئناف</option>
                    <option value="نقض">نقض</option>
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">▼</span>
                </div>

                {currentUser.permissions.addCase && (
                  <button
                    onClick={handleOpenAdd}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs py-2.5 px-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    ملف قضية جديد
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Litigations Grid / Table */}
          {filteredCases.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-4 shadow-3xs">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                <Gavel className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800">لا توجد نتائج بحث مطابقة</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">يمكنك إعادة تعديل الكلمات البحثية الذكية أو تصفير الفلاتر الجانبية للوصول لملف النزاع المطلق.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredCases.map((c) => {
                // Determine right-side accent border depending on the Litigation Degree
                let cardAccentBorder = 'border-r-4 border-r-amber-500';
                if (c.degree === 'استئناف') {
                  cardAccentBorder = 'border-r-4 border-r-sky-600';
                } else if (c.degree === 'نقض') {
                  cardAccentBorder = 'border-r-4 border-r-indigo-700';
                }

                // Determine tag styling for Case Type
                let typeBadgeStyle = 'bg-slate-50 text-slate-700 border-slate-200';
                if (c.type === 'جنائي' || c.type === 'جنح' || c.type === 'ادارى') {
                  typeBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-200/50';
                } else if (c.type === 'إيجارات') {
                  typeBadgeStyle = 'bg-amber-50 text-amber-850 border-amber-200/50';
                } else if (c.type === 'أحوال شخصية') {
                  typeBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
                } else if (c.type === 'مدني' || c.type === 'صحة توقيع') {
                  typeBadgeStyle = 'bg-blue-50 text-blue-700 border-blue-200/50';
                }

                const hasNextHearing = !!c.nextHearingDate;
                const isDecided = c.status?.includes('حكم') || c.status?.includes('منتهية');
                const statusColor = isDecided ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse';

                return (
                  <div 
                    key={c.id} 
                    className={`bg-white border border-slate-150 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4 relative group ${cardAccentBorder}`}
                  >
                    
                    {(currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.permissions.deleteCase) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(c);
                          setDeleteReason('');
                          setAdminPassword('');
                          setDeleteError('');
                        }}
                        className="absolute top-4 left-4 p-2 text-red-500 hover:text-red-700 bg-red-50 border border-red-100 rounded-xl transition-all cursor-pointer z-10 shadow-3xs"
                        title="حذف نهائي للقضية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="space-y-4">
                      
                      {/* Card Header: Type tags and Folder index */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black border uppercase tracking-wider ${typeBadgeStyle}`}>
                            {c.type}
                          </span>
                          <span className="bg-slate-100 text-slate-800 text-[10px] px-2.5 py-1 rounded-lg font-extrabold border border-slate-200">
                            {c.degree}
                          </span>
                          {c.officeFileNo && (
                            <span className="bg-amber-500/10 text-amber-900 text-[10px] px-2.5 py-1 rounded-lg font-black flex items-center gap-1 border border-amber-500/20 shadow-3xs">
                              <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                              {c.officeFileNo}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          #{c.id.substring(5, 11).toUpperCase()}
                        </span>
                      </div>

                      {/* Case Numbers & Litigation Docket */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-xl shrink-0 mt-0.5">
                            <Scale className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                              رقم أول درجة: <span className="font-mono text-amber-800 font-black">{toAr(c.caseNumberFirstInstance)}</span> لسنة <span className="font-mono text-amber-800 font-black">{toAr(c.caseYearFirstInstance)}</span>
                            </h4>
                            
                            {c.caseNumberSecondInstance && (
                              <div className="mt-2 text-xs text-slate-600 font-bold flex items-center gap-1.5 border-t border-slate-100 pt-1.5 border-dashed">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>الاستئناف: <span className="font-mono font-bold text-slate-700">{toAr(c.caseNumberSecondInstance)}</span> لسنة <span className="font-mono font-bold text-slate-700">{toAr(c.caseYearSecondInstance)}</span></span>
                              </div>
                            )}
                            
                            {c.cassationNumber && (
                              <div className="mt-1 text-xs text-indigo-700 font-bold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                <span>طعن النقض: <span className="font-mono font-black text-indigo-850">{toAr(c.cassationNumber)}</span> لسنة <span className="font-mono font-black text-indigo-850">{toAr(c.cassationYear)}</span></span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Court Name and Circuit details */}
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <span className="text-slate-400 text-[10px]">🏛️</span>
                            <span className="font-black text-slate-800">{c.court}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] pr-4">
                            <span>⚖️</span>
                            <span>الدائرة المختصة: <strong className="text-slate-700 font-extrabold">{c.circuit}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Clients (represented party) and Opponent (adverse party) lists */}
                      <div className="bg-slate-100/40 border border-slate-200/60 rounded-xl p-3.5 space-y-3.5 text-xs">
                        
                        {/* Represented Clients */}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>الموكلين (الطرف الأول):</span>
                          </div>
                          <div className="mr-3.5 space-y-1.5">
                            {c.clientsList && c.clientsList.length > 0 ? (
                              c.clientsList.map((cl, idx) => {
                                const cleanPhone = cl.phone ? cl.phone.trim() : '';
                                return (
                                  <div key={idx} className="text-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/40 pb-1.5 last:border-0 last:pb-0">
                                    <span className="font-extrabold">• {cl.name} <span className="text-slate-400 font-medium text-[10px]">{cl.role ? `(${cl.role})` : ''}</span></span>
                                    {cleanPhone && (
                                      <div className="flex items-center gap-1.5">
                                        <a href={`tel:${cleanPhone}`} className="bg-white border border-slate-200 hover:border-amber-500/50 hover:bg-amber-50 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[10px] flex items-center gap-0.5 transition-all shadow-3xs" title="اتصال هاتفي مباشر">
                                          📞 {cleanPhone}
                                        </a>
                                        <a href={`https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] transition-all flex items-center justify-center" title="إرسال رسالة واتساب الفورية">
                                          💬
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-slate-850 font-extrabold">• {c.clientName}</div>
                            )}
                          </div>
                        </div>

                        {/* Adverse Opponents */}
                        <div className="space-y-1.5 border-t border-slate-200/60 pt-3">
                          <div className="flex items-center gap-1.5 text-red-800 font-black">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span>الخصوم والنزاع (الطرف الثاني):</span>
                          </div>
                          <div className="mr-3.5 space-y-1.5">
                            {c.opponentsList && c.opponentsList.length > 0 ? (
                              c.opponentsList.map((opp, idx) => {
                                const cleanPhone = opp.phone ? opp.phone.trim() : '';
                                return (
                                  <div key={idx} className="text-slate-700 text-[11px] flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/40 pb-1.5 last:border-0 last:pb-0">
                                    <span className="font-bold">• {opp.name} <span className="text-slate-400 font-medium text-[10px]">{opp.role ? `(${opp.role})` : ''}</span></span>
                                    <div className="flex items-center gap-1.5">
                                      {cleanPhone && (
                                        <a href={`tel:${cleanPhone}`} className="bg-white border border-slate-200 hover:border-red-500/30 text-slate-600 px-2 py-0.5 rounded-md font-mono text-[10px]" title="اتصال هاتفي بالخصم">
                                          📞 {cleanPhone}
                                        </a>
                                      )}
                                      {opp.lawyer && (
                                        <span className="text-slate-400 text-[10px] font-medium mr-1 border-r border-slate-200 pr-1.5 block leading-none">محاميه: {opp.lawyer}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-slate-700 font-bold">
                                • {c.opponent.name} <span className="text-slate-400 font-medium text-[10px]">{c.opponent.role ? `(${c.opponent.role})` : ''}</span>
                                {c.opponent.lawyer && <span className="block text-[10px] text-slate-400 font-medium mr-3.5 mt-0.5">محامي الخصم: {c.opponent.lawyer}</span>}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Next Session and Status Badges */}
                      <div className="space-y-2">
                        {/* Next session alert card */}
                        {hasNextHearing ? (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-950 p-3 rounded-xl text-xs flex items-center justify-between shadow-3xs animate-pulse">
                            <span className="font-black flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-amber-600" />
                              الجلسة القادمة:
                            </span>
                            <span className="font-mono font-black">{toAr(c.nextHearingDate)} {c.nextHearingTime ? `@ ${c.nextHearingTime}` : ''}</span>
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 text-slate-500 p-3 rounded-xl text-xs flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-slate-400">
                              <Calendar className="w-4 h-4" />
                              الجلسة القادمة:
                            </span>
                            <span className="font-bold text-slate-400 italic">غير مجدولة بعد</span>
                          </div>
                        )}

                        {/* Roll Status Bar */}
                        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold">حالة رول القضية:</span>
                          <span className="flex items-center gap-1.5 font-black text-slate-800">
                            <span className={`w-2 h-2 rounded-full ${statusColor} inline-block`} />
                            {c.status}
                          </span>
                        </div>

                        {c.prosecutorName && (
                          <p className="text-[10px] text-slate-400 font-bold pr-1.5">
                            💼 عضو النيابة المختص بالملف: <span className="text-slate-600 font-black">{c.prosecutorName}</span>
                          </p>
                        )}
                      </div>

                    </div>

                    {/* Exquisite Action Buttons */}
                    <div className="border-t border-slate-150 pt-4 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        {currentUser.permissions.printCase && (
                          <button
                            onClick={() => { setShowDocViewer(c); setDocViewerTab('docs'); }}
                            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-xs font-black rounded-xl shadow-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            ملف القضية الشامل ({c.files.length})
                          </button>
                        )}
                        {currentUser.permissions.printCase && (
                          <button
                            onClick={() => setShowReportViewer(c)}
                            className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-95 shadow-3xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            عرض التقرير القضائي
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-3.5 text-xs border-t border-slate-100/50 pt-3">
                        {currentUser.permissions.editCase && (
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            ✏️ تعديل البيانات
                          </button>
                        )}

                        {currentUser.permissions.archiveCase && (
                          <button
                            onClick={() => {
                              setArchiveTarget(c);
                              setArchiveReason('صدر حكم نهائي');
                              setCustomArchiveReason('');
                              setArchiveNotes('');
                            }}
                            className="text-emerald-600 hover:text-emerald-800 hover:underline font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            نقل للأرشيف
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Companies Action Bar */}
          <div className="bg-gradient-to-b from-slate-50 to-white border-t-4 border-t-indigo-600 border border-slate-200 rounded-2xl p-5 shadow-sm animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800">سجل وثائق وعقود الشركات التجارية والمؤسسات</h3>
                <p className="text-xs text-slate-400 mt-1">إدارة الملفات التأسيسية، الشركاء والأنصبة، شهادات الضريبة والقيمة المضافة لعملاء المكتب من الشركات.</p>
              </div>
              {currentUser.permissions.addCompany && (
                <button
                  onClick={() => handleOpenCompanyForm(null)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  تسجيل شركة جديدة
                </button>
              )}
            </div>
          </div>

          {/* Companies Grid / Table */}
          {filteredCompanies.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-4 shadow-3xs animate-fadeIn">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 shadow-inner">
                <Building2 className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800">لا توجد شركات مسجلة مطابقة</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">يمكنك تعديل البحث أو تسجيل شركة تجارية جديدة بالنظام للبدء في تدوين وثائق التأسيس والشراكة.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
              {filteredCompanies.map((co) => {
                return (
                  <div 
                    key={co.id} 
                    className="bg-white border-r-4 border-r-indigo-600 border border-slate-150 hover:border-slate-300 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4 relative group"
                  >
                    
                    {(currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.permissions.deleteCompany) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteCompanyTarget(co);
                          setDeleteCompanyPassword('');
                          setDeleteCompanyError('');
                        }}
                        className="absolute top-4 left-4 p-2 text-red-500 hover:text-red-700 bg-red-50 border border-red-100 rounded-xl transition-all cursor-pointer z-10 shadow-3xs"
                        title="حذف نهائي للشركة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="space-y-4">
                      
                      {/* Company Header Card */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[10px] px-2.5 py-1 rounded-lg font-black uppercase">
                            {co.companyType || 'شركة مساهمة'}
                          </span>
                          {co.stage === 'post-establishment' ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] px-2.5 py-1 rounded-lg font-black flex items-center gap-1 shadow-3xs">
                              📈 ما بعد التأسيس
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] px-2.5 py-1 rounded-lg font-black flex items-center gap-1 shadow-3xs animate-pulse">
                              🏗️ قيد التأسيس
                            </span>
                          )}
                          {co.officeFileNumber && (
                            <span className="bg-amber-500/10 text-amber-900 border border-amber-500/20 text-[10px] px-2.5 py-1 rounded-lg font-black flex items-center gap-1 shadow-3xs">
                              <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
                              {co.officeFileNumber}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          #{co.id.substring(8, 14).toUpperCase() || co.id.substring(0, 6).toUpperCase()}
                        </span>
                      </div>

                      {/* Title & Natural Activity */}
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 leading-tight">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          {co.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-bold mt-1.5">النشاط التجاري: <span className="text-slate-800 font-extrabold">{co.activityType}</span></p>
                      </div>

                      {/* Company Details with executive metadata lines */}
                      <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200/40 pb-1.5">
                          <span className="text-slate-400">السجل التجاري:</span>
                          <strong className="text-slate-800 font-mono font-bold">{toAr(co.commercialRegister) || 'غير مدرج'}</strong>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200/40 pb-1.5">
                          <span className="text-slate-400">البطاقة الضريبية:</span>
                          <strong className="text-slate-800 font-mono font-bold">{toAr(co.taxCard) || 'غير مدرج'}</strong>
                        </div>
                        {co.vatCertificate && (
                          <div className="flex items-center justify-between border-b border-slate-200/40 pb-1.5">
                            <span className="text-slate-400">شهادة القيمة المضافة:</span>
                            <strong className="text-slate-800 font-mono font-bold">{toAr(co.vatCertificate)}</strong>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-b border-slate-200/40 pb-1.5">
                          <span className="text-slate-400">الهاتف والاتصال:</span>
                          {co.phone ? (
                            <a href={`tel:${co.phone}`} className="text-blue-600 hover:underline font-mono font-black">
                              📞 {co.phone}
                            </a>
                          ) : (
                            <span className="text-slate-450 italic">غير مدرج</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 pt-0.5">
                          <span className="text-slate-400">المقر الرئيسي والعنوان:</span>
                          <span className="text-slate-800 font-extrabold leading-relaxed break-words">{co.address || 'العنوان غير محدد'}</span>
                        </div>
                      </div>

                      {/* Partners Summary block */}
                      <div className="text-[11px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl flex items-center justify-between shadow-3xs">
                        <span className="flex items-center gap-1.5 font-black">
                          <Users className="w-4 h-4 text-indigo-600" />
                          الشركاء والأنصبة المسجلة:
                        </span>
                        <span className="font-black text-indigo-950 bg-white border border-indigo-200 px-2.5 py-0.5 rounded-lg shadow-3xs">
                          {co.partners?.length || 0} شركاء
                        </span>
                      </div>

                    </div>

                    {/* Exquisite Action buttons */}
                    <div className="border-t border-slate-150 pt-4 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setViewDocsCompany(co)}
                          className="py-2.5 px-3 bg-slate-900 hover:bg-slate-850 text-amber-400 hover:text-amber-300 text-xs font-black rounded-xl shadow-xs transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          الوثائق ({co.documents?.length || 0})
                        </button>
                        <button
                          onClick={() => handlePrintCompanyProfile(co)}
                          className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black rounded-xl transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-95 shadow-3xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          طباعة ملف التأسيس
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-3.5 text-xs border-t border-slate-100/50 pt-3">
                        {currentUser.permissions.editCompany && (
                          <button
                            onClick={() => handleOpenCompanyForm(co)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            ✏️ تعديل ملف التأسيس
                          </button>
                        )}

                        {currentUser.permissions.archiveCompany && (
                          <button
                            onClick={() => {
                              setArchiveCoTarget(co);
                              setArchiveCoReason('انتهاء التعاقد مع المكتب');
                              setCustomArchiveCoReason('');
                              setArchiveCoNotes('');
                            }}
                            className="text-emerald-600 hover:text-emerald-800 hover:underline font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            أرشفة الملف
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add / Edit Case Form Modal */}
      <BaseModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingCase ? `تعديل ملف القضية` : 'فتح ملف نزاع قضائي جديد'}
        description={editingCase ? `تعديل البيانات القانونية لملف القضية الحالي ومراجعة المراحل` : 'تسجيل ملف نزاع قضائي وتعيين أطراف الخصومة والنيابة المختصة'}
        icon={Gavel}
        size="4xl"
      >
        {showFormModal && (
          <>
            {/* Stepper Navigation */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto select-none mb-6">
          {[
            { id: 'judicial', label: 'البيانات القضائية', desc: 'المحكمة والدائرة', icon: Gavel },
            { id: 'litigants', label: 'أطراف الدعوى', desc: 'الموكلين والخصوم', icon: UserCheck },
            { id: 'financials', label: 'الأتعاب والتعليمات', desc: 'العقد والدفاع', icon: Coins },
            { id: 'attachments', label: 'المستندات والأوراق', desc: 'صحف الدعاوى والأحكام', icon: Paperclip }
          ].map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeFormTab === step.id;
            const isCompleted = ['judicial', 'litigants', 'financials', 'attachments'].indexOf(activeFormTab) > idx;
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

        {/* Modal Body Form */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            
            // 1. Validate Judicial
            if (!caseNo1st.trim()) {
              setActiveFormTab('judicial');
              alert('يرجى كتابة رقم القضية في مرحلة أول درجة للتمكن من الحفظ.');
              return;
            }
            if (!caseYear1st.trim()) {
              setActiveFormTab('judicial');
              alert('يرجى كتابة سنة القضية في مرحلة أول درجة للتمكن من الحفظ.');
              return;
            }

             // 2. Validate Litigants (at least one client and opponent)
             const activeClients = formClients.filter(cl => cl.name && cl.name.trim() !== '');
             if (activeClients.length === 0) {
               setActiveFormTab('litigants');
               alert('يرجى إضافة واسم موكل واحد على الأقل للمتابعة.');
               return;
             }
             for (let idx = 0; idx < formClients.length; idx++) {
               if (!formClients[idx].name.trim()) {
                 setActiveFormTab('litigants');
                 alert(`يرجى كتابة الاسم الكامل للموكل رقم ${idx + 1}.`);
                 return;
               }
               if (!formClients[idx].role || !formClients[idx].role.trim()) {
                 setActiveFormTab('litigants');
                 alert(`يرجى تحديد صفة الموكل رقم ${idx + 1} بالدعوى.`);
                 return;
               }
             }
             
             const activeOpponents = formOpponents.filter(opp => opp.name && opp.name.trim() !== '');
             if (activeOpponents.length === 0) {
               setActiveFormTab('litigants');
               alert('يرجى إضافة واسم خصم واحد على الأقل للمتابعة.');
               return;
             }
             for (let idx = 0; idx < formOpponents.length; idx++) {
               if (!formOpponents[idx].name.trim()) {
                 setActiveFormTab('litigants');
                 alert(`يرجى كتابة اسم الخصم رقم ${idx + 1}.`);
                 return;
               }
               if (!formOpponents[idx].role || !formOpponents[idx].role.trim()) {
                 setActiveFormTab('litigants');
                 alert(`يرجى تحديد صفة الخصم رقم ${idx + 1} بالدعوى.`);
                 return;
               }
             }

            handleSubmit(e);
          }} 
          className="space-y-6"
        >
          
          {/* Judicial Section */}
          {activeFormTab === 'judicial' && (
            <div className="space-y-6">
              
              {/* Stage Toggles and general fields */}
              <FormCard title="بيانات درجة التقاضي ونوع الدعوى" icon={Gavel}>
                <FormGrid cols={3}>
                  <FormField label="درجة التقاضي الحالية" required>
                    <select
                      value={degree}
                      onChange={(e) => {
                        const val = e.target.value as LitigationDegree;
                        setDegree(val);
                        if (val === 'استئناف') {
                          setShowAppealSection(true);
                        } else if (val === 'نقض') {
                          setShowAppealSection(true);
                          setShowCassationSection(true);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                    >
                      <option value="أول درجة">أول درجة</option>
                      <option value="استئناف">استئناف</option>
                      <option value="نقض">نقض</option>
                    </select>
                  </FormField>

                  <FormField label="نوع القضية" required>
                    <select
                      value={caseType}
                      onChange={(e) => setCaseType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
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
                  </FormField>

                  <FormField label="رقم الملف بالمكتب (اختياري)" isMono>
                    <div className="relative">
                      <span className="absolute right-3 top-2.5 text-slate-400">
                        <FolderOpen className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder="مثال: م-2026/15"
                        value={officeFileNo}
                        onChange={(e) => setOfficeFileNo(e.target.value)}
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </FormField>
                </FormGrid>

                <div className="flex items-center gap-6 mt-4 pt-2.5 border-t border-slate-100/60">
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
                  <div className="mt-4">
                    <FormField label="اكتب نوع القضية المخصص" required>
                      <input
                        type="text"
                        placeholder="مثال: تحكيم هندسي، استثمار"
                        value={customCaseType}
                        onChange={(e) => setCustomCaseType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-sans"
                      />
                    </FormField>
                  </div>
                )}
              </FormCard>

              {/* First Instance Card */}
              <FormCard title="أولاً: مرحلة أول درجة" icon={Gavel}>
                <FormGrid cols={5}>
                  <FormField label="المحكمة">
                    <CourtSelect
                      value={court1st}
                      onChange={setCourt1st}
                      placeholder="مثال: محكمة أسرة التجمع"
                    />
                  </FormField>
                  <FormField label="مقر الانعقاد">
                    <input
                      type="text"
                      placeholder="مثال: القاهرة الجديدة"
                      value={venue1st}
                      onChange={(e) => setVenue1st(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all"
                    />
                  </FormField>
                  <FormField label="الدائرة">
                    <input
                      type="text"
                      placeholder="مثال: الدائرة 3 إيجارات"
                      value={circuit1st}
                      onChange={(e) => setCircuit1st(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all"
                    />
                  </FormField>
                  <FormField label="رقم القضية" required isMono>
                    <input
                      type="text"
                      placeholder="رقم الدعوى"
                      value={caseNo1st}
                      onChange={(e) => setCaseNo1st(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all text-left font-mono"
                      dir="ltr"
                    />
                  </FormField>
                  <FormField label="سنة القضية" required isMono>
                    <input
                      type="text"
                      placeholder="2026"
                      value={caseYear1st}
                      onChange={(e) => setCaseYear1st(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 focus:border-amber-500 transition-all text-left font-mono"
                      dir="ltr"
                    />
                  </FormField>
                </FormGrid>
              </FormCard>

              {/* Appeal Card */}
              {showAppealSection && (
                <FormCard title="ثانياً: مرحلة الاستئناف" icon={Gavel}>
                  <div className="absolute top-4 left-4">
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
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        إلغاء التفعيل وحذف البيانات
                      </button>
                    )}
                  </div>
                  <FormGrid cols={5}>
                    <FormField label="المحكمة">
                      <CourtSelect
                        value={court2nd}
                        onChange={setCourt2nd}
                        placeholder="مثال: استئناف عالي شمال"
                      />
                    </FormField>
                    <FormField label="مقر الانعقاد">
                      <input
                        type="text"
                        placeholder="مثال: العباسية"
                        value={venue2nd}
                        onChange={(e) => setVenue2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="الدائرة">
                      <input
                        type="text"
                        placeholder="الدائرة 5 مستأنف"
                        value={circuit2nd}
                        onChange={(e) => setCircuit2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="رقم الاستئناف" isMono>
                      <input
                        type="text"
                        placeholder="رقم الاستئناف"
                        value={caseNo2nd}
                        onChange={(e) => setCaseNo2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                    <FormField label="سنة الاستئناف" isMono>
                      <input
                        type="text"
                        placeholder="السنة"
                        value={caseYear2nd}
                        onChange={(e) => setCaseYear2nd(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                  </FormGrid>
                </FormCard>
              )}

              {showCassationSection && (
                <FormCard title="ثالثاً: مرحلة الطعن بالنقض" icon={Gavel}>
                  <div className="absolute top-4 left-4">
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
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        إلغاء التفعيل وحذف البيانات
                      </button>
                    )}
                  </div>
                  <FormGrid cols={5}>
                    <FormField label="محكمة النقض (أو المختصة)">
                      <CourtSelect
                        value={courtCass}
                        onChange={setCourtCass}
                        placeholder="مثال: محكمة النقض العليا"
                      />
                    </FormField>
                    <FormField label="مقر الانعقاد">
                      <input
                        type="text"
                        placeholder="مثال: دار القضاء العالي"
                        value={venueCass}
                        onChange={(e) => setVenueCass(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="الدائرة">
                      <input
                        type="text"
                        placeholder="مثال: الدائرة الجنائية"
                        value={circuitCass}
                        onChange={(e) => setCircuitCass(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                    <FormField label="رقم الطعن" isMono>
                      <input
                        type="text"
                        placeholder="رقم الطعن"
                        value={cassationNumber}
                        onChange={(e) => setCassationNumber(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                    <FormField label="سنة الطعن" isMono>
                      <input
                        type="text"
                        placeholder="السنة"
                        value={cassationYear}
                        onChange={(e) => setCassationYear(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white text-left font-mono"
                        dir="ltr"
                      />
                    </FormField>
                  </FormGrid>
                </FormCard>
              )}

              {/* Hearing & Extra Info row */}
              <FormCard title="المتابعة وتاريخ الجلسة القادمة" icon={Calendar}>
                <FormGrid cols={4}>
                  <FormField label="تاريخ الجلسة القادمة" isMono>
                    <input
                      type="date"
                      value={nextHearing}
                      onChange={(e) => setNextHearing(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>
                  <FormField label="ساعة انعقاد الجلسة" isMono>
                    <input
                      type="time"
                      value={nextHearingTime}
                      onChange={(e) => setNextHearingTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>
                  <FormField label="حالة رول الجلسة والدعوى">
                    <input
                      type="text"
                      placeholder="مثال: مؤجلة للاطلاع..."
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                    />
                  </FormField>
                  <FormField label="رقم الحصر (إن وجد)">
                    <input
                      type="text"
                      placeholder="حصر التنفيذ أو الحصر العقاري"
                      value={enforcementNo}
                      onChange={(e) => setEnforcementNo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                    />
                  </FormField>
                </FormGrid>

                {(caseType === 'جنائي' || caseType === 'جنح' || caseType === 'ادارى' || caseType === 'مخالفات') && (
                  <div className="mt-4">
                    <FormField label="اسم السيد عضو النيابة العامة المسؤول عن المحضر">
                      <input
                        type="text"
                        placeholder="الأستاذ وكيل النيابة أو رئيس النيابة"
                        value={prosecutor}
                        onChange={(e) => setProsecutor(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                      />
                    </FormField>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  <FormField label="موضوع الدعوى">
                    <textarea
                      placeholder="اكتب موضوع القضية أو عريضة الدعوى بشكل واضح هنا..."
                      value={caseSubject}
                      onChange={(e) => setCaseSubject(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 transition-all font-sans"
                    />
                  </FormField>

                  <FormField label="ملاحظات ودفوع جوهرية بالملف">
                    <textarea
                      placeholder="اكتب أية دفوع أو ثغرات أو تعليمات للمرافعة هنا..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15 transition-all font-sans"
                    />
                  </FormField>
                </div>
              </FormCard>

              {/* Expert Referral Section (إحالة القضية إلى الخبراء) */}
              <FormCard title="إحالة القضية إلى الخبراء" icon={UserCheck}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800">القضية محالة إلى الخبراء</p>
                        <p className="text-[11px] text-slate-500">تفعيل خيار إحالة الدعوى إلى خبراء وزارة العدل لمتابعة الجلسات والمستندات والتقرير</p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isReferredToExperts}
                        onChange={(e) => {
                          setIsReferredToExperts(e.target.checked);
                          if (e.target.checked && status === 'متداولة بجلسات المحكمة') {
                            setStatus('محالة إلى الخبراء');
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {isReferredToExperts && (
                    <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
                      <FormGrid cols={3}>
                        <FormField label="تاريخ قرار الإحالة">
                          <input
                            type="date"
                            value={expertReferralDate}
                            onChange={(e) => setExpertReferralDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white font-mono"
                          />
                        </FormField>

                        <FormField label="المحكمة / الدائرة مصدرة القرار">
                          <input
                            type="text"
                            placeholder="مثال: دائرة مدني كلي جنوب القاهرة"
                            value={expertCourtOrCircuit}
                            onChange={(e) => setExpertCourtOrCircuit(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                          />
                        </FormField>

                        <FormField label="سبب قرار الإحالة">
                          <input
                            type="text"
                            placeholder="مثال: احتساب الريع ونفي الغصب وتصفية الحسابات"
                            value={expertReferralReason}
                            onChange={(e) => setExpertReferralReason(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                          />
                        </FormField>
                      </FormGrid>

                      <FormGrid cols={4}>
                        <FormField label="مكتب الخبراء المختص">
                          <input
                            type="text"
                            placeholder="مثال: مكتب خبراء وزارة العدل بالزيتون"
                            value={expertOffice}
                            onChange={(e) => setExpertOffice(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                          />
                        </FormField>

                        <FormField label="رقم ملف الخبراء" isMono>
                          <input
                            type="text"
                            placeholder="مثال: 1420 / 2026"
                            value={expertFileNumber}
                            onChange={(e) => setExpertFileNumber(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>

                        <FormField label="اسم الخبير المنتدب (اختياري)">
                          <input
                            type="text"
                            placeholder="اسم الخبير (إن وجد)"
                            value={expertName}
                            onChange={(e) => setExpertName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                          />
                        </FormField>

                        <FormField label="تاريخ أول جلسة خبرة (إن وجد)">
                          <input
                            type="date"
                            value={expertFirstSessionDate}
                            onChange={(e) => setExpertFirstSessionDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white font-mono"
                          />
                        </FormField>
                      </FormGrid>

                      <FormField label="ملاحظات وتوجيهات الإحالة">
                        <textarea
                          rows={2}
                          placeholder="أي ملاحظات هامة تخص مرحلة الخبراء..."
                          value={expertNotes}
                          onChange={(e) => setExpertNotes(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              </FormCard>

            </div>
          )}

          {/* Litigants details */}
          {activeFormTab === 'litigants' && (
            <div className="space-y-6">

              {/* Quick Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 select-none">
                  <PlusCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                  إجراءات سريعة لإضافة الأطراف:
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={addFormClient}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white hover:text-amber-300 text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    إضافة موكل جديد 👤
                  </button>
                  <button
                    type="button"
                    onClick={addFormOpponent}
                    className="px-3.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-50 hover:text-amber-200 text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    إضافة خصم جديد ⚖️
                  </button>
                </div>
              </div>
              
              {/* Clients Section */}
              <FormCard title="الموكلين وأصحاب الشأن (الطرف الأول)" icon={UserCheck}>
                <div className="space-y-4 pt-2">
                  {formClients.map((cl, idx) => (
                    <div key={idx} className="bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-xl p-4 transition-all duration-200 relative">
                      
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                        <span className="bg-slate-900 text-slate-100 text-[10px] font-black px-2.5 py-1 rounded-md">
                          الموكل رقم {idx + 1}
                        </span>
                        {formClients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFormClient(idx)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="حذف هذا الموكل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Card Body */}
                      <FormGrid cols={4}>
                        <FormField label="اختر موكل مسجل بالنظام (اختياري)">
                          <select
                            value={clients.some(c => c.name === cl.name) ? cl.name : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const found = clients.find(c => c.name === val);
                                if (found) {
                                  updateFormClient(idx, {
                                    name: found.name,
                                    phone: found.phone || '',
                                    email: found.email || '',
                                    id: found.id
                                  });
                                }
                              } else {
                                updateFormClient(idx, { name: '', phone: '', email: '', id: '' });
                              }
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">-- اختيار موكل مسجل --</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="الاسم بالكامل (مطلوب)" required>
                          <input
                            type="text"
                            placeholder="مثال: أحمد محمد علي"
                            value={cl.name}
                            onChange={(e) => updateFormClient(idx, { name: e.target.value })}
                            required
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          />
                        </FormField>

                        <FormField label="الصفة بالدعوى (مطلوب)" required>
                          <SearchableDropdown
                            value={cl.role || ''}
                            onChange={(val) => updateFormClient(idx, { role: val })}
                            options={capacityOptions}
                            placeholder="اختر الصفة بالدعوى (مطلوب)"
                            required
                          />
                        </FormField>

                        <FormField label="رقم الهاتف (اختياري)" isMono>
                          <input
                            type="tel"
                            placeholder="مثال: 01xxxxxxxxx"
                            value={cl.phone}
                            onChange={(e) => updateFormClient(idx, { phone: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </FormGrid>

                      <div className="mt-3">
                        <FormField label="البريد الإلكتروني (اختياري)" isMono>
                          <input
                            type="email"
                            placeholder="example@mail.com"
                            value={cl.email}
                            onChange={(e) => updateFormClient(idx, { email: e.target.value })}
                            className="w-full max-w-md px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </div>

                    </div>
                  ))}
                </div>
              </FormCard>

              {/* Opponents Section */}
              <FormCard title="الخصوم وأطراف النزاع (الطرف الثاني)" icon={ShieldAlert}>
                <div className="space-y-4 pt-2">
                  {formOpponents.map((opp, idx) => (
                    <div key={idx} className="bg-slate-50 hover:bg-slate-100/50 border border-slate-150 rounded-xl p-4 transition-all duration-200 relative">
                      
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                        <span className="bg-red-950 text-red-100 text-[10px] font-black px-2.5 py-1 rounded-md">
                          الخصم رقم {idx + 1}
                        </span>
                        {formOpponents.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFormOpponent(idx)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="حذف هذا الخصم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Card Body */}
                      <FormGrid cols={3}>
                        <FormField label="اسم الخصم بالكامل (مطلوب)" required>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="الاسم بالكامل أو اسم الشركة الخصم"
                              value={opp.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                const isPublicProsecution = newName.trim() === 'النيابة العامة';
                                const updatedFields: Partial<Opponent> = { name: newName };
                                if (!isPublicProsecution && opp.role === 'سلطة اتهام') {
                                  updatedFields.role = 'مدعى عليه';
                                }
                                updateFormOpponent(idx, updatedFields);
                              }}
                              required
                              className="w-full px-3 py-1.5 pl-24 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-right"
                            />
                            <button
                              type="button"
                              onClick={() => updateFormOpponent(idx, { name: 'النيابة العامة', role: 'سلطة اتهام' })}
                              className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-amber-50 hover:bg-amber-500 hover:text-white border border-amber-200 hover:border-amber-500 text-[10px] text-amber-700 font-extrabold px-2.5 py-1 rounded-md transition-all duration-150 cursor-pointer shadow-sm"
                              title="اختيار النيابة العامة كخصم وتحديد صفتها كـ سلطة اتهام"
                            >
                              النيابة العامة
                            </button>
                          </div>
                        </FormField>

                        <FormField label="الصفة بالدعوى (مطلوب)" required>
                          <SearchableDropdown
                            value={opp.role || ''}
                            onChange={(val) => updateFormOpponent(idx, { role: val })}
                            options={opp.name && opp.name.trim() === 'النيابة العامة' ? [...capacityOptions, 'سلطة اتهام'] : capacityOptions}
                            placeholder="اختر الصفة بالدعوى (مطلوب)"
                            required
                          />
                        </FormField>

                        <FormField label="هاتف الخصم (اختياري)" isMono>
                          <input
                            type="tel"
                            placeholder="رقم الهاتف"
                            value={opp.phone}
                            onChange={(e) => updateFormOpponent(idx, { phone: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </FormGrid>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                        <div className="md:col-span-2">
                          <FormField label="عنوان الخصم لإعلان الصحيفة (اختياري)">
                            <input
                              type="text"
                              placeholder="العنوان التفصيلي لإعلان المحضرين"
                              value={opp.address}
                              onChange={(e) => updateFormOpponent(idx, { address: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </FormField>
                        </div>
                        <FormField label="الزميل محامي الخصم والمكتب (اختياري)">
                          <input
                            type="text"
                            placeholder="الأستاذ محامي الطرف الثاني"
                            value={opp.lawyer}
                            onChange={(e) => updateFormOpponent(idx, { lawyer: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </FormField>
                      </div>

                      <div className="mt-3 max-w-sm">
                        <FormField label="رقم هاتف محامي الخصم (اختياري)" isMono>
                          <input
                            type="tel"
                            placeholder="رقم هاتف المحامي"
                            value={opp.lawyerPhone}
                            onChange={(e) => updateFormOpponent(idx, { lawyerPhone: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-left"
                            dir="ltr"
                          />
                        </FormField>
                      </div>

                    </div>
                  ))}
                </div>
              </FormCard>

            </div>
          )}

          {/* Financials & Assignment */}
          {activeFormTab === 'financials' && (
            <div className="space-y-6">
              <FormCard title="عقد الأتعاب وتكليف الدفاع" icon={Coins}>
                <FormGrid cols={3}>
                  <FormField label="إجمالي مبلغ الأتعاب بالعقد (ج.م)" isMono>
                    <input
                      type="number"
                      value={totalFees}
                      onChange={(e) => setTotalFees(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>

                  <FormField label="المدفوع كمقدم تعاقد (ج.م)" isMono>
                    <input
                      type="number"
                      value={paidFees}
                      onChange={(e) => setPaidFees(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </FormField>

                  <FormField label="المحامي المكلف بالملف والمرافعة" required>
                    <select
                      value={assignedLawyer}
                      onChange={(e) => setAssignedLawyer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-3 focus:ring-amber-500/15"
                    >
                      <option value="">اختر محامياً من المؤسسة</option>
                      {users.filter(u => u.role === 'lawyer' || u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.title})</option>
                      ))}
                    </select>
                  </FormField>
                </FormGrid>


              </FormCard>
            </div>
          )}

          {/* Attachments Section */}
          {activeFormTab === 'attachments' && (
            <div className="space-y-6">
              <FormCard title="صحف الدعاوى والأحكام والمستندات الرسمية" icon={Paperclip}>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-5">
                  
                  <div className="space-y-4">
                    <MultiUploadManager
                      categories={['صحيفة دعوى', 'مذكرة دفاع', 'حافظة مستندات', 'حكم', 'محضر جلسة', 'توكيل', 'تقرير خبير', 'إنذار رسمي', 'أخرى']}
                      defaultCategory="صحيفة دعوى"
                      uploaderName={currentUser.fullName}
                      onFilesUploaded={(newFiles) => {
                        setUploadedFiles(prev => {
                          const newList = [...prev, ...newFiles];
                          if (editingCase) {
                            const updatedCase = { ...editingCase, files: newList };
                            onUpdateCase(updatedCase);
                          }
                          return newList;
                        });
                      }}
                    />
                  </div>

                  {/* Uploaded items list inside modal rendered as a grid of beautiful separate cards */}
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-black text-slate-850 flex items-center gap-1.5">
                        <Paperclip className="w-5 h-5 text-amber-500" />
                        المستندات المرفقة بملف الدعوى حتى الآن ({uploadedFiles.length})
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">بوابة مؤسسة رميح للمحاماة الرقمية</span>
                    </div>

                    {uploadedFiles.length === 0 ? (
                      <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-xs">
                        <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[11px] text-slate-400 italic">لا توجد مستندات أو أوراق مرفقة بهذا الملف حتى الآن.</p>
                        <p className="text-[9px] text-slate-400 mt-1">يرجى اختيار ملف وكتابة تفاصيله ثم الضغط على زر "إرفاق المستند بالملف" أعلاه.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                        {uploadedFiles.map((f) => {
                          const formatConfig = 
                            f.type === 'pdf' ? { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200/60' } :
                            f.type === 'word' ? { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200/60' } :
                            { label: 'IMAGE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };

                          return (
                            <div 
                              key={f.id} 
                              className="bg-white border border-slate-200 hover:border-amber-400/50 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group"
                            >
                              {/* Left status accent strip matching file type */}
                              <div className={`absolute top-0 bottom-0 right-0 w-1 ${
                                f.type === 'pdf' ? 'bg-rose-500' : f.type === 'word' ? 'bg-blue-500' : 'bg-emerald-500'
                              }`} />

                              <div className="space-y-3 pr-2">
                                {/* Header: name + format badge */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="truncate flex-1">
                                    <h6 className="text-[11px] font-black text-slate-950 truncate" title={f.name}>
                                      📄 {f.name}
                                    </h6>
                                  </div>
                                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border leading-none ${formatConfig.bg}`}>
                                    {formatConfig.label}
                                  </span>
                                </div>

                                {/* 4 Organized Fields Grid (Evenly spaced) */}
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] border-t border-slate-150 pt-2.5">
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">نوع المستند القضائي:</span>
                                    <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded text-[9px] inline-block mt-0.5">
                                      💼 {f.category || 'غير محدد'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">حجم الملف:</span>
                                    <span className="font-mono font-bold text-slate-700 inline-block mt-1">
                                      💾 {f.size || '1.24 MB'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">تاريخ الرفع والضم:</span>
                                    <span className="font-mono font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                                      📅 {f.uploadDate}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[9px] font-medium">بواسطة الزميل:</span>
                                    <span className="font-bold text-slate-700 truncate block mt-0.5" title={f.uploadedBy || 'المدير العام'}>
                                      👤 {f.uploadedBy || 'المدير العام'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Card Actions */}
                              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 mt-3 pr-2">
                                <button
                                  type="button"
                                  onClick={() => handleViewFile(f)}
                                  className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  👁️ عرض المستند
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(f.id)}
                                  className="px-2.5 py-1 text-red-650 hover:bg-red-50 hover:text-red-755 text-[10px] font-bold rounded-lg transition-all border border-transparent hover:border-red-100"
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
              {/* Modal Actions */}
              <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl shrink-0" dir="rtl">
                
                {/* Right Side: Back or Cancel */}
                <div>
                  {activeFormTab !== 'judicial' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs: ('judicial' | 'litigants' | 'financials' | 'attachments')[] = ['judicial', 'litigants', 'financials', 'attachments'];
                        const currentIdx = tabs.indexOf(activeFormTab);
                        if (currentIdx > 0) {
                          setActiveFormTab(tabs[currentIdx - 1]);
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
                      onClick={() => setShowFormModal(false)}
                      className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs rounded-xl font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      إلغاء التغييرات
                    </button>
                  )}
                </div>

                {/* Left Side: Next, Quick Save, or Submit */}
                <div className="flex items-center gap-2.5">
                  {activeFormTab !== 'attachments' && (
                    <button
                      type="button"
                      onClick={() => {
                        // Validate current tab before moving forward
                        if (activeFormTab === 'judicial') {
                          if (!caseNo1st.trim()) {
                            alert('يرجى كتابة رقم القضية للمتابعة.');
                            return;
                          }
                          if (!caseYear1st.trim()) {
                            alert('يرجى كتابة سنة القضية للمتابعة.');
                            return;
                          }
                        } else if (activeFormTab === 'litigants') {
                          const activeClients = formClients.filter(cl => cl.name && cl.name.trim() !== '');
                          if (activeClients.length === 0) {
                            alert('يرجى إضافة واسم موكل واحد على الأقل للمتابعة.');
                            return;
                          }
                          for (let idx = 0; idx < formClients.length; idx++) {
                            if (!formClients[idx].name.trim()) {
                              alert(`يرجى كتابة الاسم الكامل للموكل رقم ${idx + 1}.`);
                              return;
                            }
                            if (!formClients[idx].role || !formClients[idx].role.trim()) {
                              alert(`يرجى تحديد صفة الموكل رقم ${idx + 1} بالدعوى.`);
                              return;
                            }
                          }
                          
                          const activeOpponents = formOpponents.filter(opp => opp.name && opp.name.trim() !== '');
                          if (activeOpponents.length === 0) {
                            alert('يرجى إضافة واسم خصم واحد على الأقل للمتابعة.');
                            return;
                          }
                          for (let idx = 0; idx < formOpponents.length; idx++) {
                            if (!formOpponents[idx].name.trim()) {
                              alert(`يرجى كتابة اسم الخصم رقم ${idx + 1}.`);
                              return;
                            }
                            if (!formOpponents[idx].role || !formOpponents[idx].role.trim()) {
                              alert(`يرجى تحديد صفة الخصم رقم ${idx + 1} بالدعوى.`);
                              return;
                            }
                          }
                        }

                        const tabs: ('judicial' | 'litigants' | 'financials' | 'attachments')[] = ['judicial', 'litigants', 'financials', 'attachments'];
                        const currentIdx = tabs.indexOf(activeFormTab);
                        if (currentIdx < tabs.length - 1) {
                          setActiveFormTab(tabs[currentIdx + 1]);
                        }
                      }}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
                    >
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}

                  {/* Quick Save Option for Power Users */}
                  {activeFormTab !== 'attachments' && (
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      حفظ وتأكيد الآن
                    </button>
                  )}

                  {activeFormTab === 'attachments' && (
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-black transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {editingCase ? 'حفظ تعديلات الملف النهائي' : 'تأكيد وإنشاء قضية جديدة'}
                    </button>
                  )}
                </div>

              </div>

            </form>
          </>
        )}
      </BaseModal>

      {/* Case Document Viewer Modal / Smart Case File Page */}
      {showDocViewer && (
        <SmartCaseFile
          caseData={showDocViewer}
          currentUser={currentUser}
          users={users}
          sessions={sessions}
          clients={clients}
          onUpdateCase={async (updated) => {
            await onUpdateCase(updated);
            setShowDocViewer(updated);
          }}
          onAddSession={onAddSession}
          onUpdateSession={onUpdateSession}
          onClose={() => setShowDocViewer(null)}
        />
      )}

      {/* Decision / Outcome Recording & Editing Modal */}
      {decisionSession && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-right" dir="rtl">
            <div className="p-4 bg-slate-800/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {decisionSession.decision ? 'تعديل قرار الجلسة والنتيجة' : 'تسجيل ورصد قرار الجلسة'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDecisionSession(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDecisionSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <p>⚖️ <strong>تفاصيل الجلسة:</strong> {decisionSession.subject}</p>
                <p>📅 <strong>تاريخ الانعقاد الحالي:</strong> <span className="font-mono text-amber-400">{decisionSession.date}</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">منطوق قرار المحكمة (رول الجلسة) *</label>
                <textarea
                  placeholder="مثال: التأجيل لجلسة القادمة لتقديم المستندات والاطلاع على التقرير..."
                  value={decisionText}
                  onChange={(e) => setDecisionText(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">تاريخ الجلسة القادمة (إن وجد)</label>
                  <input
                    type="date"
                    value={decisionNextHearingDate}
                    onChange={(e) => setDecisionNextHearingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">حالة الجلسة</label>
                  <div className="text-[11px] bg-emerald-500/15 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30 font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    سيتم قيدها كـ "تمت ورصدت بالأجندة"
                  </div>
                </div>
              </div>

              {/* Upload roll photo real input and display */}
              <div className="bg-slate-950 p-4 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
                <div>
                  <p className="text-xs font-bold text-slate-300 mb-1">إرفاق صورة رول الجلسة أو مستند منطوق الحكم</p>
                  <p className="text-[10px] text-slate-500 mb-3">يمكنك تحميل مستند حقيقي (صورة، PDF، Word) مباشرة من جهازك</p>
                </div>
                
                <div className="flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => sessionFileInputRef.current?.click()}
                    className="bg-slate-800 hover:bg-slate-750 text-amber-400 hover:text-amber-300 border border-slate-700 hover:border-slate-600 font-bold text-[11px] py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer mx-auto"
                  >
                    <Upload className="w-4 h-4 text-amber-400" />
                    تحميل مستند القرار من الجهاز 💻
                  </button>
                  <input
                    ref={sessionFileInputRef}
                    id="session-device-file-input"
                    type="file"
                    className="hidden"
                    onChange={handleSessionDeviceUpload}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                  />

                  {stagedSessionFile ? (
                    <div className="w-full max-w-sm mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between animate-fadeIn text-right" dir="rtl">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-[11px] font-bold text-emerald-300 truncate" title={stagedSessionFile.originalName}>
                          {stagedSessionFile.originalName} ({stagedSessionFile.size})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStagedSessionFile(null);
                          setRollPhotoUrl('');
                        }}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="إلغاء الملف"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500">لم يتم اختيار مستند من الجهاز بعد</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-900/60 text-right">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">أو كتابة اسم/رابط الملف يدوياً</label>
                  <input
                    type="text"
                    placeholder="مثال: session_decision_capture.jpg"
                    value={rollPhotoUrl}
                    onChange={(e) => setRollPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setDecisionSession(null);
                    setStagedSessionFile(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-2 rounded-xl font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  حفظ ورصد القرار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3">ترحيل القضية إلى الأرشيف النهائي</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              سيتم الاحتفاظ بكامل بيانات القضية رقم <strong>{archiveTarget.caseNumberFirstInstance} لسنة {archiveTarget.caseYearFirstInstance}</strong> وملفاتها وأوراقها، ولن يتم حذفها، بل تُنقل للأرشيف للرجوع إليها لاحقاً.
            </p>

            {archiveError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {archiveError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">سبب الأرشفة</label>
                <select
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="صدر حكم نهائي">صدر حكم نهائي</option>
                  <option value="تم التنفيذ">تم التنفيذ</option>
                  <option value="الصلح">الصلح والتسوية الودية</option>
                  <option value="التنازل">تنازل الموكل</option>
                  <option value="حفظ الأوراق">حفظ الأوراق إدارياً</option>
                  <option value="بناءً على طلب المدير">بناءً على طلب المدير المسؤول</option>
                  <option value="انتهاء العمل المطلوب">انتهاء العمل المطلوب</option>
                  <option value="إيقاف العمل مؤقتاً">إيقاف العمل مؤقتاً</option>
                  <option value="سبب آخر">سبب آخر (أدخل كتابةً)</option>
                </select>
              </div>

              {archiveReason === 'سبب آخر' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اكتب سبب الأرشفة اليدوي</label>
                  <input
                    type="text"
                    placeholder="مثال: وفاة الموكل، إلغاء التوكيل"
                    value={customArchiveReason}
                    onChange={(e) => setCustomArchiveReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات ختامية حول الأرشفة</label>
                <textarea
                  placeholder="مثال: تم سداد كامل الأتعاب وإغلاق التوكيل رسمياً..."
                  value={archiveNotes}
                  onChange={(e) => setArchiveNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة مرور الدخول الخاصة بك لتأكيد الأرشفة</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={archivePassword}
                  onChange={(e) => setArchivePassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setArchiveTarget(null);
                  setArchivePassword('');
                  setArchiveError('');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={handleArchiveSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                نقل للأرشيف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal (Super Admin Verification) */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">تنبيه أمان صارم: حذف نهائي للقضية</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              تحذير: لا يوجد حذف مباشر في نظام وزارة العدل بالمؤسسة. الحذف النهائي مسموح به فقط لـ <strong className="text-slate-800">مدير النظام (Super Admin)</strong> مع تسجيل العملية تلقائياً في سجل الأنشطة والعمليات للرقابة.
            </p>

            {deleteError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {deleteError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">سبب الحذف الجوهري</label>
                <input
                  type="text"
                  placeholder="مثال: إدخال خاطئ مكرر"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة مرور مدير النظام للتأكيد</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">تلميح للمعاينة: اكتب كلمة مرور حسابك الحالي (أو كلمة "admin") للتخطي الفوري.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء وتراجع
              </button>
              <button
                onClick={handleDeleteSubmit}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                تأكيد الحذف النهائي والتسجيل باللوج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Company Form Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white rounded-t-2xl shrink-0">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                {editingCompany ? `تعديل الملف القانوني لشركة - ${editingCompany.name}` : 'تسجيل ملف شركة جديدة'}
              </h3>
              <button 
                onClick={() => setShowCompanyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Two Main Stage Tabs (🏗️ / 📈) */}
            {editingCompany && (
              <div className="bg-slate-950 text-white px-6 py-2 border-b border-slate-800 flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyStageTab('establishment');
                    setActiveCompanyFormTab('primary');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    companyStageTab === 'establishment'
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🏗️ مرحلة التأسيس وقيد السجل
                </button>
                <button
                  type="button"
                  disabled={(editingCompany.stage as any) !== 'post-establishment' && companyStageTab !== 'post-establishment'}
                  onClick={() => {
                    setCompanyStageTab('post-establishment');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    companyStageTab === 'post-establishment'
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                      : ((editingCompany.stage as any) === 'post-establishment' || (companyStageTab as string) === 'post-establishment')
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  📈 مرحلة ما بعد التأسيس (الخدمات والخصومات)
                  {((editingCompany.stage as any) !== 'post-establishment' && companyStageTab !== 'post-establishment') && (
                    <span className="text-[9px] bg-slate-900 text-amber-500 px-1.5 py-0.5 rounded border border-slate-750">🔒 مغلق</span>
                  )}
                </button>
              </div>
            )}

            {/* Stepper Navigation */}
            {(!editingCompany || companyStageTab === 'establishment') && (
              <div className="p-6 pb-0 shrink-0">
                <div className="bg-slate-50 border border-slate-150 rounded-2xl px-6 py-3 flex items-center justify-between gap-2 overflow-x-auto select-none">
                  {[
                    { id: 'primary', label: 'البيانات الأساسية', desc: 'الاسم والقيد والنشاط', icon: Building2 },
                    { id: 'partners', label: 'سجل الشركاء والموكلين', desc: 'الحصص الرأسمالية والممثلين', icon: Users },
                    { id: 'documents', label: 'وثائق ومستندات الشركة', desc: 'عقد التأسيس والأوراق الرسمية', icon: Paperclip },
                    { id: 'tasks', label: 'المهام والمواعيد', desc: 'متابعة التأسيس', icon: Calendar, disabled: !editingCompany }
                  ].filter(step => !step.disabled || editingCompany).map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = activeCompanyFormTab === step.id;
                    const isCompleted = ['primary', 'partners', 'documents', 'tasks'].indexOf(activeCompanyFormTab) > idx;
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
              </div>
            )}

            {/* Modal Body */}
            <form onSubmit={handleCompanySubmit} className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Primary Data */}
              {activeCompanyFormTab === 'primary' && (
                <div className="animate-fadeIn">
                  <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4">أولاً: البيانات الأساسية والقيد التجاري</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الشركة بالكامل</label>
                      <input
                        type="text"
                        value={coName}
                        onChange={(e) => setCoName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        placeholder="مثال: شركة النيل للتطوير العقاري (ش.م.م)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الشركة</label>
                      <select
                        value={coType}
                        onChange={(e) => setCoType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-amber-500"
                      >
                        <option value="شركة مساهمة">شركة مساهمة</option>
                        <option value="شركة ذات مسئولية محدودة">شركة ذات مسئولية محدودة</option>
                        <option value="شركة شخص واحد">شركة شخص واحد</option>
                        <option value="شركة توصية بسيطة">شركة توصية بسيطة</option>
                        <option value="شركة تضامن">شركة تضامن</option>
                        <option value="منشأة فردية">منشأة فردية</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">السجل التجاري (اختياري)</label>
                      <input
                        type="text"
                        value={coRegister}
                        onChange={(e) => setCoRegister(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                        placeholder="مثال: 123456"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">البطاقة الضريبية (اختياري)</label>
                      <input
                        type="text"
                        value={coTaxCard}
                        onChange={(e) => setCoTaxCard(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                        placeholder="مثال: 987-654-321"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">شهادة القيمة المضافة (اختياري)</label>
                      <input
                        type="text"
                        value={coVat}
                        onChange={(e) => setCoVat(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-left"
                        dir="ltr"
                        placeholder="مثال: VAT-776"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">طبيعة النشاط والترخيص</label>
                      <input
                        type="text"
                        value={coActivity}
                        onChange={(e) => setCoActivity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        placeholder="مثال: مقاولات عمومية وتوريدات"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">هاتف للتواصل</label>
                      <input
                        type="text"
                        value={coPhone}
                        onChange={(e) => setCoPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                        dir="ltr"
                        placeholder="مثال: 0225487965"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                        رقم ملف الشركة بالمكتب (اختياري)
                      </label>
                      <input
                        type="text"
                        value={coOfficeFileNumber}
                        onChange={(e) => setCoOfficeFileNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        placeholder="مثال: م/2026/12"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان المقر الرئيسي بالتفصيل</label>
                      <input
                        type="text"
                        value={coAddress}
                        onChange={(e) => setCoAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        placeholder="العاصمة الإدارية الجديدة، الحي المالي، برج 10"
                      />
                    </div>
                  </div>

                  {/* Establishment Stage Indicator & Action Button */}
                  {editingCompany && (
                    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">حالة ملف التأسيس:</span>
                          {(editingCompany.stage === 'post-establishment' || companyStageTab === 'post-establishment') ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-lg">
                              مكتمل وتحت المتابعة ✅
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2.5 py-1 rounded-lg animate-pulse">
                              قيد التأسيس والإجراء ⏳
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold">
                          عند استكمال كافة المستندات والبيانات والشركاء، يمكنك نقل الشركة لمرحلة "ما بعد التأسيس" لتفعيل خدمات العقود والقضايا والخصومات.
                        </p>
                      </div>

                      {(editingCompany.stage !== 'post-establishment' && companyStageTab !== 'post-establishment') && (
                        <button
                          type="button"
                          disabled={!coName.trim() || !coRegister.trim() || !coTaxCard.trim()}
                          onClick={async () => {
                            const updatedCompany: Company = {
                              ...editingCompany,
                              name: coName,
                              companyType: coType,
                              commercialRegister: coRegister,
                              taxCard: coTaxCard,
                              vatCertificate: coVat || undefined,
                              activityType: coActivity,
                              address: coAddress,
                              phone: coPhone,
                              officeFileNumber: coOfficeFileNumber || undefined,
                              partners: coPartners,
                              documents: companyDocsList,
                              stage: 'post-establishment'
                            };
                            await onUpdateCompany(updatedCompany);
                            setEditingCompany(updatedCompany);
                            setCompanyStageTab('post-establishment');
                            if (onAddAuditLog) {
                              onAddAuditLog(currentUser, 'edit', `تحويل ملف الشركة القانوني: ${coName} إلى مرحلة ما بعد التأسيس (قائمة الشركاء والخصومات النشطة)`);
                            }
                            alert('تهانينا! تم ترقية ملف الشركة بنجاح إلى مرحلة ما بعد التأسيس.');
                          }}
                          className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                            (!coName.trim() || !coRegister.trim() || !coTaxCard.trim())
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white cursor-pointer hover:scale-[1.02]'
                          }`}
                        >
                          🚀 تحويل إلى مرحلة ما بعد التأسيس
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Partners and Shares */}
              {activeCompanyFormTab === 'partners' && (
                <div className="animate-fadeIn space-y-8">
                  {/* Part 1: Partners & Shares */}
                  <div>
                    <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4 flex items-center gap-1.5">
                      <span>👥 أولاً: سجل الشركاء والحصص الرأسمالية (تأسيسياً)</span>
                    </h4>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Right Form: Add/Autofill Partner */}
                      <div className="lg:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-200/85 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                          <h5 className="text-xs font-black text-slate-800">إضافة شريك جديد لعقد التأسيس</h5>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold">أو استيراد من موكل مسجل:</span>
                            <select
                              value={autofillClientId}
                              onChange={(e) => {
                                const cid = e.target.value;
                                setAutofillClientId(cid);
                                const found = clients.find(cl => cl.id === cid);
                                if (found) {
                                  setPartName(found.name);
                                  setPartPhone(found.phone);
                                  setPartId(found.nationalId || '');
                                  setPartAddress(found.address || '');
                                }
                              }}
                              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-[10px] text-slate-600 outline-none cursor-pointer"
                            >
                              <option value="">-- اختر موكل مسجل --</option>
                              {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">اسم الشريك بالكامل (مطلوب)</label>
                            <input
                              type="text"
                              value={partName}
                              onChange={(e) => setPartName(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-400"
                              placeholder="اسم الشريك رباعي"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">نسبة المشاركة في رأس المال (%)</label>
                            <input
                              type="number"
                              value={partPercentage}
                              onChange={(e) => setPartPercentage(Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-400"
                              min={1}
                              max={100}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">قيمة الحصة المالية (ج.م)</label>
                            <input
                              type="number"
                              value={partShare}
                              onChange={(e) => setPartShare(Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">الرقم القومي (14 رقم)</label>
                            <input
                              type="text"
                              value={partId}
                              onChange={(e) => setPartId(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-left outline-none focus:border-slate-400"
                              dir="ltr"
                              placeholder="29012345678901"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">هاتف الشريك</label>
                            <input
                              type="text"
                              value={partPhone}
                              onChange={(e) => setPartPhone(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left outline-none focus:border-slate-400"
                              dir="ltr"
                              placeholder="01xxxxxxxxx"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">عنوان إقامة الشريك</label>
                            <input
                              type="text"
                              value={partAddress}
                              onChange={(e) => setPartAddress(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-400"
                              placeholder="المحافظة والحي بالتفصيل"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/50">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={registerPartnerAsClient}
                              onChange={(e) => setRegisterPartnerAsClient(e.target.checked)}
                              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-[11px] font-bold text-slate-600">
                              تسجيل الشريك كـ موكل مرتبط بالشركة بالنظام تلقائياً
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={handleAddPartner}
                            className="bg-slate-900 hover:bg-slate-800 text-amber-400 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
                          >
                            ➕ إضافة الشريك وتأكيده
                          </button>
                        </div>
                      </div>

                      {/* Left Side: Distribution & Visual Stats */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/85 flex flex-col justify-between">
                        <div>
                          <h5 className="text-xs font-black text-slate-800 mb-1.5">هيكل رأس مال الشركة وتوزيع الحصص</h5>
                          <p className="text-[10px] text-slate-400 font-bold mb-4">يتم احتساب النسب تلقائياً بناءً على الحصص المسجلة للشركاء المقيدين.</p>
                          
                          {coPartners.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-[11px] font-bold">
                              لا توجد بيانات شركاء لعرض توزيع الحصص.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {coPartners.map((partner, idx) => (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-slate-700">{partner.name}</span>
                                    <span className="font-mono text-slate-500">{partner.participationPercentage}%</span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                                      style={{ width: `${partner.participationPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-200/60 mt-4 text-center">
                          <div className="text-[10px] text-slate-400 font-bold">إجمالي رأس المال التأسيسي المرصود:</div>
                          <div className="text-md font-black text-slate-800 mt-1">
                            {(coPartners.reduce((acc, curr) => acc + curr.shareValue, 0)).toLocaleString()} ج.م
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Partners Table */}
                    <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-700">
                          <tr className="border-b border-slate-150">
                            <th className="p-3 border-b font-black">اسم الشريك</th>
                            <th className="p-3 border-b font-black text-center">النسبة</th>
                            <th className="p-3 border-b font-black">قيمة الحصة</th>
                            <th className="p-3 border-b font-black">الرقم القومي</th>
                            <th className="p-3 border-b font-black">الهاتف</th>
                            <th className="p-3 border-b font-black text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {coPartners.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-400 font-medium">لم يتم تسجيل أي شركاء حتى الآن في عقد التأسيس</td>
                            </tr>
                          ) : (
                            coPartners.map((partner, index) => {
                              const isPartnerClient = clients.some(c => c.name === partner.name);
                              return (
                                <tr key={index} className="hover:bg-slate-50/50 transition-all">
                                  <td className="p-3 font-bold text-slate-800">
                                    <div className="flex flex-col">
                                      <span>{partner.name}</span>
                                      {index === 0 && (
                                        isPartnerClient ? (
                                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                                            ✅ الشريك الأول (موكل رسمي مسجل بالنظام 🔗)
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[10px] text-amber-600 font-bold">
                                              ⚠️ الشريك الأول (غير مسجل كـ موكل)
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleLinkPartnerAsClient(partner)}
                                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-black underline cursor-pointer"
                                            >
                                              ربطه بالنظام 🔗
                                            </button>
                                          </div>
                                        )
                                      )}
                                      {index > 0 && !isPartnerClient && (
                                        <button
                                          type="button"
                                          onClick={() => handleLinkPartnerAsClient(partner)}
                                          className="text-[9px] text-slate-400 hover:text-indigo-600 font-bold text-right mt-0.5 underline cursor-pointer"
                                        >
                                          ربط الشريك كـ موكل بالنظام 🔗
                                        </button>
                                      )}
                                      {index > 0 && isPartnerClient && (
                                        <span className="text-[9px] text-slate-400 font-medium text-right mt-0.5">
                                          ✓ موكل مسجل بالنظام
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-center text-indigo-650 font-bold">{partner.participationPercentage}%</td>
                                  <td className="p-3 font-mono text-emerald-700 font-bold">{partner.shareValue.toLocaleString()} ج.م</td>
                                  <td className="p-3 font-mono text-slate-500">{partner.nationalId || 'غير مسجل'}</td>
                                  <td className="p-3 font-mono text-slate-500">{partner.phone || 'غير مسجل'}</td>
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePartner(index)}
                                      className="text-red-500 hover:text-red-700 font-black text-[11px] hover:underline cursor-pointer"
                                    >
                                      ❌ حذف
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Part 2: Linked Clients & Legal Representatives (Cohesively Integrated!) */}
                  <div className="pt-6 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-indigo-700 pb-2 mb-4 flex items-center gap-1.5">
                      <span>🔗 ثانياً: الموكلين والممثلين القانونيين المعتمدين للشركة</span>
                    </h4>

                    {/* Linked Clients List */}
                    <div className="space-y-3 mt-4">
                      <h5 className="text-xs font-bold text-slate-800">قائمة الموكلين والممثلين الحاليين للشركة ({clients.filter(c => c.companyId === (editingCompany?.id || currentCompanyId)).length})</h5>
                      {clients.filter(c => c.companyId === (editingCompany?.id || currentCompanyId)).length === 0 ? (
                        <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                          لا يوجد موكلين مرتبطين بهذه الشركة حالياً.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {clients.filter(c => c.companyId === (editingCompany?.id || currentCompanyId)).map(client => (
                            <div key={client.id} className="bg-white border border-slate-150 p-4 rounded-xl flex items-center justify-between hover:shadow-xs transition-all">
                              <div>
                                <h6 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                  👤 {client.name}
                                  <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">موكل رسمي</span>
                                </h6>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400 mt-2">
                                  <span>📞 {client.phone}</span>
                                  {client.nationalId && <span>🪪 {client.nationalId}</span>}
                                  {client.job && <span className="col-span-2">💼 {client.job}</span>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onUpdateClient) {
                                    onUpdateClient({ ...client, companyId: '' });
                                    if (onAddAuditLog) {
                                      onAddAuditLog(currentUser, 'edit', `إلغاء ارتباط الموكل: ${client.name} من الشركة: ${coName}`);
                                    }
                                    alert('تم إلغاء ارتباط الموكل بالشركة.');
                                  }
                                }}
                                className="px-2.5 py-1.5 text-red-650 hover:bg-red-50 text-[10px] font-bold rounded-lg border border-transparent hover:border-red-100 transition-all cursor-pointer"
                                title="إلغاء ارتباط هذا الموكل بالشركة"
                              >
                                إلغاء الارتباط 🔗
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Company Legal Documents */}
              {activeCompanyFormTab === 'documents' && (
                <div className="space-y-6 animate-fadeIn">
                  <FormCard title="عقود ووثائق ومستندات الشركة الرسمية" icon={Paperclip}>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-5">
                      
                      {/* Document and Attachment System with MultiUploadManager (Matching the Add Case layout) */}
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
                              const newList = [...prev, ...converted];
                              if (editingCompany) {
                                const updatedCompany = { ...editingCompany, documents: newList };
                                onUpdateCompany(updatedCompany);
                              }
                              return newList;
                            });
                          }}
                        />
                      </div>

                      {/* Attached Items List inside Company Form */}
                      <div className="pt-4 border-t border-slate-150 space-y-3">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[11px] font-black text-slate-850 flex items-center gap-1.5">
                            <Paperclip className="w-5 h-5 text-amber-500" />
                            المستندات القانونية المرفقة بملف الشركة حتى الآن ({companyDocsList.length})
                          </span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-md font-bold">ملفات مؤمنة سحابياً 🔒</span>
                        </div>

                        {companyDocsList.length === 0 ? (
                          <div className="bg-white border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-xs">
                            <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-[11px] text-slate-400 italic">لا توجد مستندات أو أوراق مرفقة بملف هذه الشركة حتى الآن.</p>
                            <p className="text-[9px] text-slate-400 mt-1">يرجى اختيار ملف وكتابة تفاصيله ثم الضغط على زر "إرفاق المستند بالملف" أعلاه.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                            {companyDocsList.map((doc) => {
                              const formatConfig = 
                                doc.type === 'pdf' ? { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200/60' } :
                                doc.type === 'word' ? { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200/60' } :
                                { label: 'IMAGE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };

                              return (
                                <div 
                                  key={doc.id} 
                                  className="bg-white border border-slate-200 hover:border-amber-400/50 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group"
                                >
                                  {/* Status accent strip */}
                                  <div className={`absolute top-0 bottom-0 right-0 w-1 ${
                                    doc.type === 'pdf' ? 'bg-rose-500' : doc.type === 'word' ? 'bg-blue-500' : 'bg-emerald-500'
                                  }`} />

                                  <div className="space-y-3 pr-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="truncate flex-1">
                                        <h6 className="text-[11px] font-black text-slate-950 truncate" title={doc.name}>
                                          📄 {doc.name}
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
                                          💼 وثيقة رسمية
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-[9px] font-medium">حجم الملف:</span>
                                        <span className="font-mono font-bold text-slate-700 inline-block mt-1">
                                          💾 {doc.storagePath ? 'سحابي معتمد' : '1.24 MB'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-[9px] font-medium">تاريخ الرفع:</span>
                                        <span className="font-mono font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                                          📅 {doc.uploadDate}
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

                                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 mt-3 pr-2">
                                    <button
                                      type="button"
                                      onClick={() => handleViewCompanyDoc(doc, { name: coName, companyType: coType, commercialRegister: coRegister, taxCard: coTaxCard, address: coAddress, activityType: coActivity, partners: coPartners } as Company)}
                                      className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      👁️ عرض المستند
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCompanyDoc(doc.id)}
                                      className="px-2.5 py-1 text-red-650 hover:bg-red-50 hover:text-red-755 text-[10px] font-bold rounded-lg transition-all border border-transparent hover:border-red-100"
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

              {/* Tasks and Appointments Tab */}
              {activeCompanyFormTab === 'tasks' && editingCompany && (
                <div className="animate-fadeIn space-y-6">
                  <h4 className="text-xs font-bold text-amber-600 border-b border-amber-100 pb-2 mb-4">
                    رابعاً: مهام ومواعيد متابعة التأسيس والإجراءات
                  </h4>

                  {/* Add Task Form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                    <h5 className="text-xs font-bold text-slate-800">إضافة مهمة جديدة لمتابعة إجراءات التأسيس</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">موضوع المهمة (مطلوب)</label>
                        <input
                          type="text"
                          value={companyTaskTitle}
                          onChange={(e) => setCompanyTaskTitle(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          placeholder="مثال: استخراج السجل التجاري من مصلحة السجل"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">المحامي المسؤول</label>
                        <select
                          value={companyTaskAssignedTo}
                          onChange={(e) => setCompanyTaskAssignedTo(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="">-- اختر المحامي --</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.fullName} ({u.title})</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">تفاصيل وتعليمات المهمة</label>
                        <textarea
                          value={companyTaskDesc}
                          onChange={(e) => setCompanyTaskDesc(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs h-16"
                          placeholder="اكتب الإرشادات والخطوات المطلوبة بالتفصيل..."
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">الأولية والخطورة</label>
                        <select
                          value={companyTaskPriority}
                          onChange={(e) => setCompanyTaskPriority(e.target.value as any)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="منخفضة">منخفضة</option>
                          <option value="متوسطة">متوسطة</option>
                          <option value="عالية">عالية</option>
                          <option value="عاجلة">عاجلة</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">تاريخ الاستحقاق النهائي</label>
                        <input
                          type="date"
                          value={companyTaskDueDate}
                          onChange={(e) => setCompanyTaskDueDate(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!companyTaskTitle.trim()) {
                            alert('يرجى تحديد موضوع المهمة أولاً');
                            return;
                          }
                          const assignedUser = users.find(u => u.id === companyTaskAssignedTo);
                          const newTask: LegalTask = {
                            id: `task-${Date.now()}`,
                            taskNumber: `TASK-${Math.floor(1000 + Math.random() * 9000)}`,
                            title: companyTaskTitle,
                            description: companyTaskDesc,
                            type: 'تأسيس شركة',
                            priority: companyTaskPriority as any,
                            createdAt: new Date().toISOString().split('T')[0],
                            executionDate: new Date().toISOString().split('T')[0],
                            executionTime: '12:00',
                            dueDate: companyTaskDueDate,
                            assignedToId: companyTaskAssignedTo || currentUser.id,
                            assignedToName: assignedUser ? assignedUser.fullName : currentUser.fullName,
                            companyId: editingCompany.id,
                            companyName: coName,
                            status: 'جديدة',
                            attachments: [],
                            followUps: [],
                            whatsappLogs: []
                          };
                          if (onAddTask) {
                            onAddTask(newTask);
                            if (onAddAuditLog) {
                              onAddAuditLog(currentUser, 'add', `إضافة مهمة جديدة لمتابعة تأسيس شركة ${coName}: ${companyTaskTitle}`);
                            }
                            setCompanyTaskTitle('');
                            setCompanyTaskDesc('');
                            setCompanyTaskPriority('متوسطة');
                            alert('تم إضافة المهمة بنجاح وتعيينها للمحامي المختص!');
                          } else {
                            alert('خطأ: لم يتم تهيئة دالة حفظ المهام');
                          }
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all"
                      >
                        ➕ إضافة المهمة وتعيينها
                      </button>
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-800">المهام والمواعيد الحالية المسجلة للشركة ({tasks.filter(t => t.companyId === editingCompany.id).length})</h5>
                    {tasks.filter(t => t.companyId === editingCompany.id).length === 0 ? (
                      <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                        لا توجد مهام أو مواعيد مسجلة لهذه الشركة بعد.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {tasks.filter(t => t.companyId === editingCompany.id).map(task => (
                          <div key={task.id} className="bg-white border border-slate-150 p-3 rounded-xl flex flex-col justify-between hover:shadow-xs transition-all">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] bg-slate-100 font-mono font-bold px-1.5 py-0.5 rounded text-slate-600">
                                  {task.taskNumber}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  task.priority === 'عاجلة' ? 'bg-red-50 text-red-700 border border-red-100' :
                                  task.priority === 'عالية' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                  'bg-slate-50 text-slate-700 border border-slate-150'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>
                              <h6 className="text-xs font-bold text-slate-800 line-clamp-1">{task.title}</h6>
                              {task.description && (
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                              )}
                            </div>
                            <div className="border-t border-slate-100/50 pt-2 mt-2 flex items-center justify-between text-[10px] text-slate-400">
                              <span>المسؤول: <strong className="text-slate-600 font-bold">{task.assignedToName}</strong></span>
                              <span>تاريخ الاستحقاق: <strong className="text-slate-600 font-mono font-bold">{task.dueDate}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 -mx-6 -mb-6 p-5 rounded-b-2xl shrink-0" dir="rtl">
                {/* Previous / Cancel Button */}
                <div>
                  {activeCompanyFormTab !== 'primary' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const tabs = ['primary', 'partners', 'documents'] as const;
                        const currentIdx = tabs.indexOf(activeCompanyFormTab as any);
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
                      إلغاء التراجع
                    </button>
                  )}
                </div>

                {/* Next / Submit / Quick Save Button */}
                <div className="flex items-center gap-2.5">
                  {activeCompanyFormTab !== 'documents' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeCompanyFormTab === 'primary') {
                          if (!coName.trim()) {
                            alert('يرجى كتابة اسم الشركة أولاً');
                            return;
                          }
                        } else if (activeCompanyFormTab === 'partners') {
                          if (coPartners.length === 0) {
                            alert('يرجى إضافة شريك واحد على الأقل للشركة أولاً باسمه');
                            return;
                          }
                        }
                        const tabs = ['primary', 'partners', 'documents'] as const;
                        const currentIdx = tabs.indexOf(activeCompanyFormTab as any);
                        if (currentIdx >= 0 && currentIdx < tabs.length - 1) {
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
                  {activeCompanyFormTab !== 'documents' && (
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      حفظ وتأكيد الآن
                    </button>
                  )}

                  {activeCompanyFormTab === 'documents' && (
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs rounded-xl font-black transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {editingCompany ? 'حفظ تعديلات الملف بالكامل' : 'تسجيل الشركة بالنظام'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Company Documents Modal */}
      {viewDocsCompany && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white rounded-t-2xl shrink-0">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                سجل وثائق وعقود وأوراق - {viewDocsCompany.name}
              </h3>
              <button onClick={() => setViewDocsCompany(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {!viewDocsCompany.documents || viewDocsCompany.documents.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center shadow-xs">
                  <Paperclip className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-400 italic">لا توجد مستندات أو أوراق مرفقة بملف هذه الشركة حتى الآن.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {viewDocsCompany.documents.map((doc) => {
                    const formatConfig = 
                      doc.type === 'pdf' ? { label: 'PDF', bg: 'bg-rose-50 text-rose-700 border-rose-200/60' } :
                      doc.type === 'word' ? { label: 'WORD', bg: 'bg-blue-50 text-blue-700 border-blue-200/60' } :
                      { label: 'IMAGE', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' };

                    return (
                      <div 
                        key={doc.id} 
                        className="bg-white border border-slate-200 hover:border-amber-400/50 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden group text-right"
                      >
                        {/* Status accent strip */}
                        <div className={`absolute top-0 bottom-0 right-0 w-1 ${
                          doc.type === 'pdf' ? 'bg-rose-500' : doc.type === 'word' ? 'bg-blue-500' : 'bg-emerald-500'
                        }`} />

                        <div className="space-y-3 pr-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate flex-1">
                              <h6 className="text-[11px] font-black text-slate-950 truncate" title={doc.name}>
                                📄 {doc.name}
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
                                💼 وثيقة رسمية
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] font-medium">حجم الملف:</span>
                              <span className="font-mono font-bold text-slate-700 inline-block mt-1">
                                💾 {doc.storagePath ? 'سحابي معتمد' : '1.24 MB'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] font-medium">تاريخ الرفع:</span>
                              <span className="font-mono font-bold text-slate-700 flex items-center gap-1 mt-0.5">
                                📅 {doc.uploadDate}
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

                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5 mt-3 pr-2">
                          <button
                            type="button"
                            onClick={() => handleViewCompanyDoc(doc, viewDocsCompany)}
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-amber-400 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer w-full text-center justify-center shadow-xs active:scale-95"
                          >
                            👁️ عرض ومعاينة المستند
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setViewDocsCompany(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Company Modal */}
      {archiveCoTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6" dir="rtl">
            <div className="flex items-center gap-2 text-amber-600 mb-3">
              <Archive className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">أرشفة الملف القانوني لشركة - {archiveCoTarget.name}</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              تنبيه: سيتم نقل ملف الشركة والشراكة بالكامل إلى "أرشيف العملاء والشركات المغلق". سيظل بإمكانك الرجوع للملف في أي وقت من لوحة أرشيف المكتب الكلي.
            </p>

            {archiveCoError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {archiveCoError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">سبب الأرشفة</label>
                <select
                  value={archiveCoReason}
                  onChange={(e) => setArchiveCoReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="انتهاء التعاقد مع المكتب">انتهاء التعاقد مع المكتب</option>
                  <option value="فسخ الشراكة الكلية للشركة">فسخ الشراكة الكلية للشركة</option>
                  <option value="تصفية النشاط التجاري للشركة">تصفية النشاط التجاري للشركة</option>
                  <option value="انتهاء العمل المطلوب">انتهاء العمل المطلوب</option>
                  <option value="إيقاف العمل مؤقتاً">إيقاف العمل مؤقتاً</option>
                  <option value="سبب آخر">سبب آخر يكتب يدوياً</option>
                </select>
              </div>

              {archiveCoReason === 'سبب آخر' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اكتب سبب الأرشفة اليدوي</label>
                  <input
                    type="text"
                    placeholder="مثال: دمج مع شركة أخرى"
                    value={customArchiveCoReason}
                    onChange={(e) => setCustomArchiveCoReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات إغلاق الملف القانوني</label>
                <textarea
                  placeholder="مثال: تم مخالصة الشركة مالياً وتسليم كافة الأصول والوثائق الأصلية..."
                  value={archiveCoNotes}
                  onChange={(e) => setArchiveCoNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة مرور الدخول الخاصة بك لتأكيد الأرشفة</label>
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={archiveCoPassword}
                  onChange={(e) => setArchiveCoPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setArchiveCoTarget(null);
                  setArchiveCoPassword('');
                  setArchiveCoError('');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={handleArchiveCoSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                تأكيد النقل للأرشيف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Company Modal (with user's actual login password verification) */}
      {deleteCompanyTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md p-6" dir="rtl">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold">تنبيه أمان صارم: حذف نهائي لشركة</h3>
            </div>
            
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              تحذير: الحذف نهائي وسيؤدي لإزالة شركة <strong className="text-slate-800">{deleteCompanyTarget.name}</strong> وكل الشركاء والملفات القانونية المرفقة تماماً من قاعدة البيانات. لتأكيد الإجراء، يرجى إدخال <strong className="text-slate-800">كلمة سر الدخول</strong> الخاصة بك.
            </p>

            {deleteCompanyError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                {deleteCompanyError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">أدخل كلمة سر دخولك الحالية للتأكيد</label>
                <input
                  type="password"
                  placeholder="كلمة مرور حسابك الشخصي"
                  value={deleteCompanyPassword}
                  onChange={(e) => setDeleteCompanyPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-left"
                  dir="ltr"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">تلميح للمعاينة: اكتب كلمة مرور حسابك الحالي (أو كلمة "admin") للتخطي الفوري.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteCompanyTarget(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={handleDeleteCompanySubmit}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg font-bold"
              >
                تأكيد حذف الشركة نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Detailed Report (PDF Simulator Modal) */}
      {showReportViewer && (() => {
        const matchedClient = clients.find(cl => cl.id === showReportViewer.clientId || cl.name === showReportViewer.clientName);
        const assignedLawyer = users.find(u => u.id === showReportViewer.assignedLawyerId);
        const caseSessions = [...sessions.filter(s => s.caseId === showReportViewer.id)].sort((a, b) => a.date.localeCompare(b.date));
        const previousDecisions = caseSessions.filter(s => s.decision && s.decision.trim() !== '');
        const openingDate = showReportViewer.files && showReportViewer.files.length > 0 
          ? showReportViewer.files.sort((a,b) => a.uploadDate.localeCompare(b.uploadDate))[0].uploadDate 
          : `01-01-${showReportViewer.caseYearFirstInstance || '2026'}`;

        return (
          <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 text-white flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-fadeIn" dir="rtl">
              
              {/* Modal Top bar */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/20">📄 معاينة التقرير الرسمي</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">التقرير القضائي والقانوني المعتمد</h3>
                    <p className="text-[11px] text-slate-400">لقضية رقم {showReportViewer.caseNumberFirstInstance} لسنة {showReportViewer.caseYearFirstInstance}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendReportWhatsApp(showReportViewer)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    إرسال للموكل واتساب
                  </button>
                  <button
                    onClick={() => handlePrintDetailedReport(showReportViewer)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة التقرير
                  </button>
                  <button
                    onClick={() => setShowReportViewer(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
 
              {/* PDF Document Page Preview Wrapper */}
              <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-xl p-8 shadow-inner space-y-6 max-w-3xl mx-auto w-full text-slate-900 relative" style={{ fontFamily: "'Cairo', sans-serif" }}>
                
                {/* Subtle watermark background for preview */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-[0.03] select-none z-0"
                  style={{
                    backgroundImage: "url('/icon-192.png')",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundSize: "280px",
                    transform: "rotate(-15deg)"
                  }}
                />

                <div className="relative z-10 space-y-6">
                  {/* PDF Header Logo and Institution */}
                  <div className="border-b-2 border-amber-700 pb-4 flex justify-between items-center">
                    <div className="text-right">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">مؤسسة رميح للمحاماة</h2>
                      <p className="text-[10px] text-amber-700 font-bold mt-1">والاستشارات القانونية وأعمال الطعن والتمثيل القضائي</p>
                      <p className="text-[9px] text-slate-400 mt-1">تأسست عام ١٩٨٥ | هاتف: ٠١٠٠٢٢٢٠٠٠</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <img src="/icon-192.png" className="w-12 h-12 object-contain" alt="Logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div className="text-left" style={{ direction: 'ltr' }}>
                      <p className="text-xs font-extrabold text-slate-900">RUMEIH LAW FIRM</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Advocacy & Legal Consultations</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Date: {new Date().toISOString().split('T')[0]}</p>
                    </div>
                  </div>

                  {/* PDF Title Banner */}
                  <div className="text-center">
                    <span className="bg-amber-50 border border-amber-200 text-amber-950 font-black text-xs px-6 py-2 rounded-xl inline-block shadow-sm">
                      التقرير القانوني الشامل والتقرير القضائي للملف
                    </span>
                  </div>

                  {/* PDF Details Section 1: Case Details */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">أولاً: بيانات ومعرفات الدعوى والتقاضي</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">رقم أول درجة:</span>
                        <span className="col-span-2 p-2 font-bold text-amber-700 text-right">{showReportViewer.caseNumberFirstInstance} لسنة {showReportViewer.caseYearFirstInstance}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">محكمة أول درجة:</span>
                        <span className="col-span-2 p-2 text-right">{showReportViewer.courtFirstInstance || showReportViewer.court || 'غير محدد'}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">رقم الاستئناف:</span>
                        <span className="col-span-2 p-2 text-right">{showReportViewer.caseNumberSecondInstance || 'غير مقيد'} {showReportViewer.caseYearSecondInstance ? 'لسنة ' + showReportViewer.caseYearSecondInstance : ''}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">محكمة الاستئناف:</span>
                        <span className="col-span-2 p-2 text-right">{showReportViewer.courtSecondInstance || 'غير مقيد'}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">نوع القضية:</span>
                        <span className="col-span-2 p-2 text-right">{showReportViewer.type}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">حالة الملف:</span>
                        <span className="col-span-2 p-2 font-bold text-amber-700 text-right">{showReportViewer.status}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">الدائرة الحالية:</span>
                        <span className="col-span-2 p-2 text-right">{showReportViewer.circuit}</span>
                      </div>
                      <div className="grid grid-cols-3 border border-slate-200 rounded-lg overflow-hidden">
                        <span className="bg-slate-50 font-bold p-2 text-slate-600 border-l border-slate-200 text-right">تاريخ الفتح:</span>
                        <span className="col-span-2 p-2 text-right">{openingDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Details Section 2: Parties */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">ثانياً: أطراف الخصومة والنزاع القضائي</h4>
                    <div className="space-y-2.5 text-xs">
                      {showReportViewer.clientsList && showReportViewer.clientsList.length > 0 ? showReportViewer.clientsList.map((cl, clIdx) => (
                        <div key={clIdx} className="border border-emerald-200 bg-emerald-50/20 rounded-lg p-3 text-right">
                          <p className="font-bold text-emerald-800">الموكل صاحب الصفة (#{clIdx + 1}): {cl.name} {cl.role ? `(${cl.role})` : ''}</p>
                          <p className="text-[10px] text-slate-500 mt-1">الهاتف: {cl.phone || 'غير مدون'} | البريد الإلكتروني: {cl.email || 'غير مدون'}</p>
                        </div>
                      )) : (
                        <div className="border border-emerald-200 bg-emerald-50/20 rounded-lg p-3 text-right">
                          <p className="font-bold text-emerald-800">الموكل (الطرف الأول): {showReportViewer.clientName}</p>
                          <p className="text-[10px] text-slate-500 mt-1">الهاتف: {matchedClient?.phone || 'غير مدون'} | الرقم القومي: {matchedClient?.nationalId || 'غير مدون'} | العنوان: {matchedClient?.address || 'غير مدون'}</p>
                        </div>
                      )}

                      {showReportViewer.opponentsList && showReportViewer.opponentsList.length > 0 ? showReportViewer.opponentsList.map((opp, oppIdx) => (
                        <div key={oppIdx} className="border border-red-200 bg-red-50/20 rounded-lg p-3 text-right">
                          <p className="font-bold text-red-800">الخصم بموجب صحيفة الدعوى (#{oppIdx + 1}): {opp.name} ({opp.role})</p>
                          <p className="text-[10px] text-slate-500 mt-1">الهاتف: {opp.phone || 'غير مدون'} | العنوان: {opp.address || 'غير مدون'} | المحامي الممثل: {opp.lawyer || 'غير مدون'}</p>
                        </div>
                      )) : (
                        <div className="border border-red-200 bg-red-50/20 rounded-lg p-3 text-right">
                          <p className="font-bold text-red-800">الخصم المدعى عليه: {showReportViewer.opponent.name} ({showReportViewer.opponent.role})</p>
                          <p className="text-[10px] text-slate-500 mt-1">هاتف الخصم: {showReportViewer.opponent.phone || 'غير مدون'} | محامي الخصم: {showReportViewer.opponent.lawyer || 'لا يوجد'} {showReportViewer.opponent.lawyerPhone ? `(${showReportViewer.opponent.lawyerPhone})` : ''}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PDF Details Section 3: Topic */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">ثالثاً: ملخص موضوع الدعوى والطلب</h4>
                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg leading-relaxed border border-slate-200 text-justify text-right">
                      {showReportViewer.notes || `هذه القضية مصنفة تحت نوع (${showReportViewer.type})، ومقيدة أمام محكمة ${showReportViewer.court} الدائرة ${showReportViewer.circuit} دفاعاً عن حقوق الموكل ${showReportViewer.clientName} ضد الخصم ${showReportViewer.opponent.name}، وتجري متابعة مذكرات الدفاع والجلسات بانتظام بواسطة المحامي المكلف.`}
                    </p>
                  </div>

                  {/* PDF Details Section 4: Previous sessions */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">رابعاً: السجل الزمني للإجراءات والقرارات التي تمت</h4>
                    {caseSessions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 border border-slate-200 rounded-lg text-right">لا توجد جلسات مجدولة أو قرارات سابقة مسجلة بالملف.</p>
                    ) : (
                      <div className="space-y-3 pr-2">
                        {caseSessions.map((sess, idx) => (
                          <div key={sess.id} className="border-r-2 border-amber-600 pr-4 relative">
                            <div className="absolute right-[-5px] top-1.5 w-2 h-2 bg-amber-600 rounded-full" />
                            <p className="text-[11px] font-bold text-amber-700">الإجراء #{idx + 1} - تاريخ: {sess.date} {sess.time ? `الساعة ${sess.time}` : ''}</p>
                            <p className="text-xs text-slate-800 font-semibold mt-1">موضوع الإجراء: {sess.subject}</p>
                            {sess.decision && <p className="text-xs text-amber-800 mt-1"><strong>قرار المحكمة الصادر:</strong> {sess.decision}</p>}
                            {sess.whatHappened && <p className="text-[11px] text-slate-500 mt-0.5">تفاصيل العمل: {sess.whatHappened}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PDF Details Section 5: Expert Referral (If applicable) */}
                  {(showReportViewer.isReferredToExperts || showReportViewer.expertReferral?.isReferred || (showReportViewer.expertReferral && (showReportViewer.expertReferral.expertOffice || showReportViewer.expertReferral.expertName))) && (
                    <div className="space-y-3 text-right">
                      <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md flex justify-between items-center">
                        <span>خامساً: تفاصيل وبيانات إحالة القضية إلى خبراء وزارة العدل</span>
                        <span className="text-[10px] bg-amber-200 text-amber-950 font-bold px-2 py-0.5 rounded">
                          {showReportViewer.expertReferral?.status || 'قيد مباشرة الخبير'}
                        </span>
                      </h4>
                      <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/20 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded border border-amber-200">
                          <div><strong>مكتب الخبراء:</strong> {showReportViewer.expertReferral?.expertOffice || 'غير محدد'}</div>
                          <div><strong>اسم الخبير:</strong> {showReportViewer.expertReferral?.expertName || 'لم يحدد بعد'} {showReportViewer.expertReferral?.expertPhone ? `(${showReportViewer.expertReferral.expertPhone})` : ''}</div>
                          <div><strong>رقم ملف الخبراء:</strong> <span className="font-mono font-bold text-amber-800">{showReportViewer.expertReferral?.fileNumber || 'غير مدون'}</span></div>
                          <div><strong>تاريخ القرار:</strong> {showReportViewer.expertReferral?.referralDate || 'غير مدون'}</div>
                        </div>

                        {showReportViewer.expertReferral?.sessions && showReportViewer.expertReferral.sessions.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-bold text-amber-900 text-[11px] block">📅 جلسات ومواعيد المباشرة بالخبراء:</span>
                            <table className="w-full text-right text-xs bg-white border border-amber-200 rounded">
                              <thead>
                                <tr className="bg-amber-100/60 font-bold border-b border-amber-200">
                                  <th className="p-1.5 text-right">تاريخ الجلسة</th>
                                  <th className="p-1.5 text-right">نوع الجلسة</th>
                                  <th className="p-1.5 text-right">ما تم والإجراء</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100">
                                {showReportViewer.expertReferral.sessions.map((es, idx) => (
                                  <tr key={idx}>
                                    <td className="p-1.5 font-bold text-amber-800 font-mono">{es.date}</td>
                                    <td className="p-1.5">{es.sessionType}</td>
                                    <td className="p-1.5 font-semibold">{es.decisionOrAction || 'حضور ومتابعة'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {showReportViewer.expertReferral?.report?.summary && (
                          <div className="bg-white p-2 rounded border border-amber-200">
                            <span className="font-bold text-amber-900 text-[11px] block mb-1">📊 ملخص ونتيجة تقرير الخبير:</span>
                            <p className="text-slate-700 text-xs leading-relaxed">{showReportViewer.expertReferral.report.summary}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PDF Details Section 6: Decisions */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">سادساً: قرارات الهيئة القضائية المعتمدة السابقة</h4>
                    {previousDecisions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 border border-slate-200 rounded-lg text-right">لم تسجل مخرجات قرارات قضائية في السجل حتى تاريخه.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                              <th className="p-2 border-l border-slate-200 text-right">تاريخ الجلسة</th>
                              <th className="p-2 text-right">القرار الصادر بموجب محضر الجلسة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {previousDecisions.map(sess => (
                              <tr key={sess.id} className="hover:bg-slate-50/50">
                                <td className="p-2 border-l border-slate-100 font-bold text-amber-700 text-right">{sess.date}</td>
                                <td className="p-2 text-right text-slate-800 font-semibold">{sess.decision}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* PDF Details Section 7: Attachments */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">سابعاً: المرفقات والمستندات المودعة بالملف القضائي</h4>
                    {!showReportViewer.files || showReportViewer.files.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 border border-slate-200 rounded-lg text-right">لا توجد مستندات أو مرفقات مؤرشفة بالملف حتى تاريخه.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                              <th className="p-2 border-l border-slate-200 text-right">اسم المستند والملف</th>
                              <th className="p-2 border-l border-slate-200 text-right">التصنيف</th>
                              <th className="p-2 border-l border-slate-200 text-right">تاريخ الإيداع</th>
                              <th className="p-2 text-right">المودع بواسطة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {showReportViewer.files.map(file => (
                              <tr key={file.id} className="hover:bg-slate-50/50">
                                <td className="p-2 border-l border-slate-100 font-semibold text-slate-800 text-right">📄 {file.name}</td>
                                <td className="p-2 border-l border-slate-100 text-right">
                                  <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">
                                    {file.category || file.type || 'مستند قانوني'}
                                  </span>
                                </td>
                                <td className="p-2 border-l border-slate-100 font-mono text-slate-500 text-right">{file.uploadDate}</td>
                                <td className="p-2 text-right text-slate-600">{file.uploadedBy || 'مكتب المحاماة'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* PDF Details Section 8: Financials and Next Session */}
                  <div className="space-y-3 text-right">
                    <h4 className="text-xs font-black text-amber-900 bg-amber-50 border-r-4 border-amber-600 px-3 py-1.5 rounded-l-md">ثامناً: الجلسة القادمة وتفاصيل الرسوم المالية</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <th className="p-2 bg-slate-50 border-l border-slate-200 text-right font-bold w-1/4">تاريخ الجلسة القادمة:</th>
                            <td className="p-2 font-bold text-amber-700 text-right">
                              {showReportViewer.nextHearingDate ? `📅 ${showReportViewer.nextHearingDate} ${showReportViewer.nextHearingTime ? `الساعة ${showReportViewer.nextHearingTime}` : ''}` : '❌ لم تحدد بعد'}
                            </td>
                            <th className="p-2 bg-slate-50 border-l border-slate-200 text-right font-bold w-1/4">حالة التنفيذ والتعويض:</th>
                            <td className="p-2 text-right">{showReportViewer.enforcementNumber ? `محضر رقم ${showReportViewer.enforcementNumber}` : 'بانتظار الحكم'}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <th className="p-2 bg-slate-50 border-l border-slate-200 text-right font-bold">إجمالي أتعاب العقد:</th>
                            <td className="p-2 text-sky-700 font-bold text-right">{showReportViewer.totalFees.toLocaleString()} ج.م</td>
                            <th className="p-2 bg-slate-50 border-l border-slate-200 text-right font-bold">المبلغ المسدد المقبوض:</th>
                            <td className="p-2 text-emerald-700 font-bold text-right">{showReportViewer.paidFees.toLocaleString()} ج.m</td>
                          </tr>
                          <tr>
                            <th className="p-2 bg-slate-50 border-l border-slate-200 text-right font-bold">المتبقي المستحق المطلوب:</th>
                            <td colSpan={3} className="p-2 text-red-600 font-black text-right text-sm">
                              {showReportViewer.remainingFees.toLocaleString()} ج.م (فقط لا غير)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stamp and signatures simulated area */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-dashed border-slate-200 text-xs">
                    <div className="text-right">
                      <p className="font-bold text-slate-700">توقيع المحامي المسؤول:</p>
                      <p className="text-[10px] text-slate-400 mt-1">الأستاذ/ {assignedLawyer?.fullName || 'عربي رميح'}</p>
                      <div className="mt-8 border-b border-dotted border-slate-300 w-32" />
                    </div>
                    <div className="flex justify-center items-center">
                      <div className="w-20 h-20 border-2 border-double border-amber-600/60 rounded-full p-1 flex items-center justify-center transform -rotate-6">
                        <div className="w-full h-full border border-dashed border-amber-600/60 rounded-full flex flex-col items-center justify-center text-[7px] text-amber-700 font-bold leading-tight">
                          <span>⚖️</span>
                          <span>مؤسسة رميح للمحاماة</span>
                          <span>معتمد ورسمي</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-700 text-left">اعتماد الإدارة العليا:</p>
                      <p className="text-[10px] text-slate-400 mt-1 text-left">المدير العام المسؤول</p>
                      <div className="mt-8 border-b border-dotted border-slate-300 w-32 mr-auto" />
                    </div>
                  </div>

                  {/* PDF Institutional Footer signature */}
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                    <span>صنع وتصميم بواسطة: الأستاذ عربي رميح</span>
                    <span>تاريخ طباعة التقرير الإلكتروني: {new Date().toISOString().split('T')[0]}</span>
                  </div>
                </div>

              </div>
 
              {/* Modal footer controls */}
              <div className="border-t border-slate-800 pt-4 mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowReportViewer(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-5 py-2 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  إغلاق نافذة المعاينة
                </button>
              </div>
 
            </div>
          </div>
        );
      })()}
    </div>
  );
}
