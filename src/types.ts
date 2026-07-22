/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'lawyer' | 'secretary' | 'employee';

export interface UserPermissions {
  // Cases
  viewCases: boolean;
  addCase: boolean;
  editCase: boolean;
  deleteCase: boolean; // Only Super Admin actually can, others can archive
  archiveCase: boolean;
  restoreCase: boolean;
  printCase: boolean;
  
  // Companies
  viewCompanies: boolean;
  addCompany: boolean;
  editCompany: boolean;
  deleteCompany: boolean;
  archiveCompany: boolean;
  restoreCompany: boolean;
  printCompany: boolean;

  // Clients
  viewClients: boolean;
  addClient: boolean;
  editClient: boolean;
  deleteClient: boolean;

  // Sessions
  addSession: boolean;
  editSession: boolean;
  deleteSession: boolean;
  recordSessionDecision: boolean;
  editSessionDecision: boolean;

  // Documents
  uploadDoc: boolean;
  downloadDoc: boolean;
  deleteDoc: boolean;
  printDoc: boolean;

  // Fees
  viewFees: boolean;
  addReceipt: boolean;
  editFees: boolean;
  deleteFees: boolean;

  // Reports
  viewReports: boolean;
  printReports: boolean;
  exportPdf: boolean;
  exportExcel: boolean;

  // User Management
  manageUsers: boolean;
  manageSettings?: boolean;

  // Tasks
  viewTasks?: boolean;
  addTask?: boolean;
  editTask?: boolean;
  deleteTask?: boolean;
  assignTask?: boolean;
  reassignTask?: boolean;
  changeTaskStatus?: boolean;
  sendTaskWhatsapp?: boolean;
  viewAllTasks?: boolean;
  viewOwnTasksOnly?: boolean;
  approveTaskCompletion?: boolean;
  reopenTask?: boolean;
  manageTasks?: boolean;
  viewUserTaskTracking?: boolean;
  viewTaskExecutionTracking?: boolean;
}

export interface User {
  id: string;
  fullName: string;
  phone: string; // Used as username
  username: string; // اسم المستخدم لربط الدخول والفرز آمنًا
  nationalId?: string; // الرقم القومي (اختياري)
  email?: string;
  role: UserRole;
  title: string; // e.g. "محامٍ نقض", "محامٍ تحت التمرين", "سكرتير إداري"
  hireDate: string;
  status: 'active' | 'suspended' | 'terminated';
  avatarUrl?: string;
  notes?: string;
  permissions: UserPermissions;
  // Account settings
  forcePasswordChange: boolean;
  expiryDate?: string;
  password?: string;
}

export type CaseType =
  | 'جنائي'
  | 'جنح'
  | 'ادارى'
  | 'مخالفات'
  | 'مدني'
  | 'إيجارات'
  | 'تجارى'
  | 'عمال'
  | 'أحوال شخصية'
  | 'مجلس الدولة'
  | 'تنفيذ'
  | 'إشكالات'
  | 'منازعات تنفيذ'
  | 'صحة توقيع'
  | string;

export type LitigationDegree = 'أول درجة' | 'استئناف' | 'نقض';

export interface Opponent {
  name: string;
  role: string; // الصفة (مدعى عليه، مستأنف ضده، إلخ)
  address: string;
  lawyer: string;
  phone: string;
  lawyerPhone?: string;
  notes?: string;
}

export interface CaseFile {
  id: string;
  name: string;
  type: 'pdf' | 'word' | 'image' | 'voice' | 'video' | 'doc';
  category: string;
  uploadDate: string;
  size: string;
  fileUrl: string; // simulated url
  uploadedBy?: string;
  storagePath?: string;
  downloadURL?: string;
}

export interface CaseClient {
  name: string;
  role?: string; // الصفة
  phone?: string; // هاتف الموكل (اختياري)
  email?: string; // البريد الإلكتروني (اختياري)
  id?: string;
}

// Expert Referral (إحالة القضية إلى الخبراء)
export interface ExpertSession {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  sessionType: 'معاينة' | 'مناقشة' | 'استلام مستندات' | 'سماع أقوال' | 'أخرى' | string;
  location: string;
  decisionOrAction: string;
  nextSessionDate?: string;
  status: 'pending' | 'completed' | 'postponed' | string;
  notes?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface ExpertDocument {
  id: string;
  title: string;
  submissionDate: string; // YYYY-MM-DD
  submittedBy?: string;
  fileUrl?: string;
  storagePath?: string;
  fileName?: string;
  notes?: string;
}

export interface ExpertRequest {
  id: string;
  requestText: string;
  requestedAt: string;
  deadlineDate?: string;
  status: 'قيد التحضير' | 'تم التقديم' | 'مطلوب تعقيب' | string;
  assignedLawyerName?: string;
  notes?: string;
}

export interface ExpertReportData {
  depositDate?: string;
  summary?: string;
  pdfUrl?: string;
  pdfName?: string;
  lawyerNotes?: string;
  resultStatus?: 'في صالح الموكل' | 'ضد الموكل' | 'محايد / إعادة للخبراء' | string;
}

export interface ExpertActionLog {
  id: string;
  actionDate: string;
  actionTitle: string;
  actionDetails: string;
  performedBy: string;
}

export interface ExpertReferralInfo {
  isReferred: boolean;
  referralDate?: string;
  courtOrCircuit?: string;
  referralReason?: string;
  expertOffice?: string;
  fileNumber?: string;
  expertName?: string;
  expertPhone?: string;
  firstSessionDate?: string;
  notes?: string;
  status?: 'قيد مباشرة الخبير' | 'تم إيداع التقرير' | 'تمت إعادة القضية للمحكمة' | string;
  
  sessions?: ExpertSession[];
  documents?: ExpertDocument[];
  requests?: ExpertRequest[];
  report?: ExpertReportData;
  actionLogs?: ExpertActionLog[];

  returnedToCourtAt?: string;
  returnedToCourtNotes?: string;
}

export interface Case {
  id: string;
  officeFileNo?: string; // رقم الملف بالمكتب
  caseNumberFirstInstance: string; // رقم أول درجة
  caseYearFirstInstance: string; // سنة أول درجة
  caseNumberSecondInstance?: string; // رقم ثاني درجة
  caseYearSecondInstance?: string; // سنة ثاني درجة
  cassationNumber?: string; // رقم طعن النقض
  cassationYear?: string; // سنة طعن النقض
  courtFirstInstance?: string;
  venueFirstInstance?: string;
  circuitFirstInstance?: string;
  courtSecondInstance?: string;
  venueSecondInstance?: string;
  circuitSecondInstance?: string;
  courtCassation?: string;
  venueCassation?: string;
  circuitCassation?: string;
  type: CaseType;
  court: string;
  circuit: string; // الدائرة
  nextHearingDate?: string;
  nextHearingTime?: string;
  status: string; // حالة القضية (متداولة، محجوزة للحكم، مؤجلة، إلخ)
  clientName: string; // اسم الموكل
  clientId: string;
  opponent: Opponent;
  clientsList?: CaseClient[];
  opponentsList?: Opponent[];
  notes?: string;
  subject?: string; // موضوع الدعوى
  prosecutorName?: string; // عضو النيابة (للجنائي والجنح والإداري)
  enforcementNumber?: string; // رقم الحصر إن وجد
  degree: LitigationDegree;
  
  // Financials
  totalFees: number;
  paidFees: number;
  remainingFees: number;
  payments: PaymentReceipt[];

  // Files
  files: CaseFile[];

  // Expert Referral (إحالة القضية إلى الخبراء)
  isReferredToExperts?: boolean;
  expertReferral?: ExpertReferralInfo;

  // Archiving
  isArchived: boolean;
  archiveDate?: string;
  archiveReason?: 'صدر حكم نهائي' | 'تم التنفيذ' | 'الصلح' | 'التنازل' | 'حفظ الأوراق' | 'بناءً على طلب المدير' | string;
  archiveNotes?: string;

  // Lawyer assignment
  assignedLawyerId?: string;
}

export interface PaymentReceipt {
  id: string;
  amount: number;
  date: string;
  receiptNumber: string; // سند القبض
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  nationalId?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  address: string;
  job: string;
  notes?: string;
  companyId?: string; // If associated with a company
  idCardUrl?: string;
  idCardName?: string;
  powerOfAttorneyUrl?: string;
  powerOfAttorneyName?: string;
}

export interface CompanyPartner {
  name: string;
  participationPercentage: number; // نسبة المشاركة
  shareValue: number; // قيمة الحصة
  nationalId: string;
  phone: string;
  address: string;
}

export interface CompanyDoc {
  id: string;
  name: string; // عقد التأسيس، النظام الأساسي، السجل التجاري، البطاقة الضريبية، إلخ
  type: 'pdf' | 'word' | 'image' | 'doc';
  uploadDate: string;
  fileUrl: string;
  storagePath?: string;
  downloadURL?: string;
}

export interface Company {
  id: string;
  name: string;
  companyType?: string; // نوع الشركة
  commercialRegister: string; // السجل التجاري
  taxCard: string; // البطاقة الضريبية
  vatCertificate?: string; // شهادة القيمة المضافة
  activityType: string; // النشاط
  address: string;
  phone: string;
  partners: CompanyPartner[];
  documents: CompanyDoc[];
  officeFileNumber?: string; // رقم ملف الشركة بالمكتب
  stage?: 'establishment' | 'post-establishment'; // افتراضياً 'establishment' لو غير موجود في السجلات القديمة
  
  // Archiving
  isArchived: boolean;
  archiveDate?: string;
  archiveReason?: 'تصفية الشركة' | 'إيقاف النشاط' | 'انتهاء التعاقد مع المكتب' | 'دمج الشركة' | string;
  archiveNotes?: string;
}

export interface HearingSession {
  id: string;
  caseId: string;
  caseNumber: string;
  caseYear: string;
  clientName: string;
  opponentName: string;
  court: string;
  circuit: string;
  type: CaseType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  subject: string; // موضوع الجلسة
  status: 'pending' | 'completed' | 'postponed'; // لم تبدأ، تمت، مؤجلة
  assignedLawyerId?: string;
  assignedLawyerName?: string;
  notes?: string;

  // Outcome details
  decision?: string; // قرار المحكمة
  nextHearingDate?: string;
  whatHappened?: string; // ما تم في الجلسة
  requirements?: string; // المطلوب للجلسة القادمة
  rollPhotoUrl?: string; // صورة رول الجلسة
}

export interface AuditLog {
  id: string;
  username: string;
  fullName: string;
  timestamp: string;
  deviceInfo: string;
  actionType: 'login' | 'logout' | 'add' | 'edit' | 'delete' | 'archive' | 'restore' | 'failed_login' | 'unauthorized_access';
  details: string;
}

export type TaskType =
  | 'حضور جلسة'
  | 'إعداد مذكرة'
  | 'رفع دعوى'
  | 'تنفيذ حكم'
  | 'استخراج مستند'
  | 'مراجعة عقد'
  | 'تأسيس شركة'
  | 'تجديد ترخيص'
  | 'مقابلة موكل'
  | 'متابعة تنفيذ'
  | 'مهمة إدارية'
  | 'أخرى';

export type TaskPriority = 'عاجلة' | 'عالية' | 'متوسطة' | 'منخفضة';

export type TaskStatus =
  | 'جديدة'
  | 'قيد التنفيذ'
  | 'بانتظار مستندات'
  | 'بانتظار إجراء'
  | 'بانتظار اعتماد المدير'
  | 'مؤجلة'
  | 'مكتملة'
  | 'ملغاة';

export interface TaskAttachment {
  id: string;
  name: string;
  type: 'PDF' | 'Word' | 'صورة' | 'ملف صوتي' | 'فيديو';
  uploadDate: string;
  uploadedBy: string;
  fileUrl: string;
  size: string;
}

export interface TaskFollowUp {
  id: string;
  date: string;
  time: string;
  username: string;
  action: string;
  notes: string;
  attachments: TaskAttachment[];
}

export interface TaskWhatsAppLog {
  id: string;
  sentAt: string;
  sentBy: string;
  recipientPhone: string;
  recipientName: string;
}

export interface LegalTask {
  id: string;
  taskNumber: string; // تلقائي
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  createdAt: string; // تلقائي
  executionDate: string;
  executionTime: string;
  dueDate: string;
  assignedToId: string;
  assignedToName: string;
  clientId?: string;
  clientName?: string;
  caseId?: string;
  caseNumber?: string;
  companyId?: string;
  companyName?: string;
  notes?: string;
  status: TaskStatus;
  attachments: TaskAttachment[];
  followUps: TaskFollowUp[];
  whatsappLogs: TaskWhatsAppLog[];
  approvedBy?: string;
  approvedAt?: string;
  managerDecision?: 'قبول' | 'عدم قبول' | 'ملاحظات';
  managerDecisionNotes?: string;
  managerDecisionDate?: string;
  progress?: number;
}

export interface ReOwner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  commissionType: 'percentage' | 'fixed_per_thousand' | 'fixed_flat';
  commissionValue: number;
  bankAccount?: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
}

export interface ReProperty {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  floorsCount: number;
  unitsCount: number;
  status: 'active' | 'under_maintenance' | 'sold';
  notes?: string;
  createdAt: string;
}

export interface ReUnit {
  id: string;
  propertyId: string;
  unitNumber: string;
  floor: number;
  activityType: 'residential' | 'commercial' | 'administrative';
  rentValue: number;
  dueDay: number;
  status: 'vacant' | 'rented' | 'maintenance';
  notes?: string;
  createdAt: string;
}

export interface ReTenant {
  id: string;
  unitId?: string;
  fullName: string;
  phone: string;
  nationalId: string;
  contractStartDate: string;
  contractEndDate: string;
  rentAmount: number;
  status: 'active' | 'expired' | 'evicted';
  attachments?: Array<{ id: string, name: string, fileUrl: string, type: string, uploadDate: string }>;
  notes?: string;
  createdAt: string;
  // Extended fields for advanced tenant & contract management
  email?: string;
  address?: string;
  nationality?: string;
  birthDate?: string;
  paymentMethod?: string;
  depositAmount?: number;
  contractDuration?: string;
  contractNumber?: string;
  ownerId?: string;
  propertyId?: string;
}

export interface ReCollectionReceipt {
  id: string;
  receiptNumber: string;
  tenantId: string;
  unitId: string;
  propertyId: string;
  amountPaid: number;
  forMonthYear: string;
  paymentDate: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'instapay' | 'vodafone_cash' | 'check';
  collectedBy: string;
  attachmentUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface RePayout {
  id: string;
  ownerId: string;
  totalCollected: number;
  commissionDeducted: number;
  expensesDeducted: number;
  netAmountPaid: number;
  payoutDate: string;
  paymentMethod: string;
  bankTransactionRef?: string;
  createdBy: string;
  attachmentUrl?: string;
  notes?: string;
  status: 'draft' | 'payout_completed';
  signedByOwner: boolean;
  signatureDate?: string;
  createdAt: string;
}

export interface RePropertyExpense {
  id: string;
  propertyId: string;
  ownerId: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
  attachmentUrl?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ReRealEstateLog {
  id: string;
  actionType: 'add' | 'edit' | 'delete' | 'collection' | 'payout';
  entityName: string;
  details: string;
  username: string;
  timestamp: string;
}

export interface ReRentDue {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantPhone?: string;
  unitId: string;
  unitNumber?: string;
  propertyId: string;
  propertyName?: string;
  ownerId: string;
  ownerName?: string;
  contractNumber?: string;
  
  forMonthYear: string; // e.g. "2026-08"
  monthNameAr: string; // e.g. "أغسطس 2026"
  dueDate: string; // e.g. "2026-08-05"
  
  rentAmount: number;
  commissionType: 'percentage' | 'fixed_per_thousand' | 'fixed_flat';
  commissionValue: number;
  commissionAmount: number;
  netOwnerAmount: number;
  
  status: 'pending' | 'overdue' | 'collected' | 'payout_pending' | 'paid_out';
  payoutStatus?: 'pending_payout' | 'paid_out';
  collectionStatus?: 'pending_collection' | 'collected' | 'overdue';
  monthClosingStatus?: 'open' | 'balanced' | 'closed';
  
  // Collection details
  collectionReceiptId?: string;
  collectedAmount?: number;
  paidDate?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  collectedBy?: string;
  collectionNotes?: string;
  
  // Payout details
  payoutId?: string;
  payoutDate?: string;
  payoutMethod?: string;
  payoutRefNo?: string;
  payoutNotes?: string;
  payoutRecordedBy?: string;

  // Closing details
  closedBy?: string;
  closedAt?: string;
  
  createdAt: string;
}


