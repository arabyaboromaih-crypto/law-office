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

  // Sessions & Agenda
  viewAgenda?: boolean;
  addAgendaHearing?: boolean;
  editAgendaHearing?: boolean;
  deleteAgendaHearing?: boolean;
  addSession: boolean;
  editSession: boolean;
  deleteSession: boolean;
  recordSessionDecision: boolean;
  editSessionDecision: boolean;

  // Real Estate & Rental Collection
  viewRealEstate?: boolean;
  addRealEstate?: boolean;
  addRealEstateProperty?: boolean;
  editRealEstate?: boolean;
  editRealEstateProperty?: boolean;
  deleteRealEstate?: boolean;
  deleteRealEstateProperty?: boolean;
  addRealEstateContract?: boolean;
  editRealEstateContract?: boolean;
  collectRent?: boolean;
  collectRealEstateRent?: boolean;
  reverseCollectRent?: boolean;
  rollbackRealEstateCollection?: boolean;
  payoutOwner?: boolean;
  disburseOwnerPayment?: boolean;
  reversePayoutOwner?: boolean;
  addRealEstateExpense?: boolean;
  manageOwnerAdvances?: boolean;
  printRealEstateReports?: boolean;

  // General Archive & Deleted Records
  viewArchive?: boolean;
  deleteArchive?: boolean;

  // Experts & Referrals
  viewExperts?: boolean;
  manageExperts?: boolean;

  // Investigations & Legal Reports
  viewInvestigationReports?: boolean;

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

  // User, System Management & Backup/Restore
  manageUsers: boolean;
  manageSettings?: boolean;
  viewBackup?: boolean;
  backupSystemData?: boolean;
  restoreBackup?: boolean;
  restoreSystemData?: boolean;

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
  | 'جنح طفل'
  | 'جنح مرور'
  | 'ادارى'
  | 'مخالفات'
  | 'مدني'
  | 'تعويضات'
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

export type LitigationDegree = 'أول درجة' | 'استئناف' | 'نقض' | 'تحقيق';

export interface Opponent {
  id?: string;
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
  reopenedReason?: string;
  reopenedAt?: string;
}

export type InvestigationActionType = 
  | 'تحقيق'
  | 'استجواب'
  | 'سماع شهود'
  | 'تجديد أمام النيابة'
  | 'تجديد جزئي'
  | 'تجديد أمام غرفة المشورة'
  | 'تجديد أمام محكمة الجنايات'
  | 'استئناف أمر الحبس'
  | 'إخلاء سبيل'
  | 'إخلاء سبيل بكفالة'
  | 'قرار النيابة'
  | 'إحالة للمحكمة'
  | 'حفظ الأوراق'
  | 'قرار آخر';

export interface DetentionRenewalRecord {
  id: string;
  court?: string; // محكمة الانعقاد
  circuit?: string; // دائرة التجديد (للتوافق مع البيانات السابقة)
  detentionStartDate?: string; // تاريخ بداية الحبس (اختياري)
  renewalDate: string; // تاريخ جلسة التجديد
  nextRenewalDate?: string; // الجلسة القادمة
  durationDays?: number; // مدة الحبس بالأيام
  duration?: string; // مدة الحبس (مثال: 15 يوماً)
  renewalNumber?: number | string; // رقم قرار / جلسة التجديد
  decisionNumber?: string; // رقم القرار
  decision?: string; // قرار محكمة التجديد اليوم
  authority: string; // سلطة إصدار قرار التجديد
  nextAuthority?: string; // الجهة المنظور أمامها التجديد القادم
  notes?: string; // ملاحظات
  date?: string; // تاريخ الجلسة
  attachments?: InvestigationAttachment[]; // إرفاق مستندات جلسة اليوم
}

export interface InvestigationAttachment {
  id: string;
  name: string;
  url?: string;
  downloadURL?: string;
  fileUrl?: string;
  type?: string;
  size?: number;
}

export interface InvestigationProcedure {
  id: string;
  sessionDate: string; // YYYY-MM-DD
  actionType: InvestigationActionType;
  authority: string; // الجهة المختصة
  decision: string; // القرار الصادر
  renewalDays?: number; // مدة التجديد بالأيام
  detentionEndDate?: string; // تاريخ انتهاء مدة الحبس
  defendantStatus?: string; // حالة المتهم
  notes?: string; // الملاحظات
  attachments?: InvestigationAttachment[];
  createdAt?: string;
  updatedAt?: string;
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

  // Investigation Stage (مرحلة التحقيق والحبس الاحتياطي)
  isInvestigationActive?: boolean;
  investigationArchived?: boolean;
  investigationProcedures?: InvestigationProcedure[];
  investigationNumber?: string;
  investigationYear?: string;
  investigationAuthority?: string;
  investigationStartDate?: string;
  detentionStartDate?: string; // تاريخ بداية الحبس الاحتياطي
  investigationDefendantStatus?: string;
  detentionRenewals?: DetentionRenewalRecord[];
  investigationNotes?: string;

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

  // Detention Renewal details (جلسات تجديد الحبس الاحتياطي)
  isDetentionRenewal?: boolean;
  detentionStartDate?: string; // تاريخ بداية الحبس
  detentionDurationDays?: number; // مدة الحبس بالأيام
  detentionDuration?: string; // مدة الحبس
  detentionRenewalDate?: string; // تاريخ التجديد
  detentionRenewalNumber?: number | string; // رقم قرار / جلسة التجديد
  detentionDecisionNumber?: string; // رقم القرار
  detentionAuthority?: string; // جهة التجديد الحالية
  detentionNextAuthority?: string; // جهة التجديد القادمة
  detentionNumber?: number;
  detentionRenewalId?: string;

  // Expert Session details (جلسات الخبراء)
  isExpertSession?: boolean;
  expertSessionId?: string;
}

export type CaseSession = HearingSession;

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
  status: 'active' | 'suspended' | 'expired' | 'evicted';
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
  accountingStartMonth?: string;
  accountingEndMonth?: string;
  suspensionDate?: string;
  reactivationDate?: string;
  suspensionHistory?: Array<{ suspendedAt: string; reactivatedAt?: string; notes?: string }>;
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
  dueId?: string;
  attachmentUrl?: string;
  notes?: string;
  status?: 'collected' | 'reverted' | 'draft' | string;
  isCancelled?: boolean;
  updatedAt?: string;
  revertedAt?: string;
  createdAt: string;
}

export interface RePayout {
  id: string;
  ownerId: string;
  propertyId?: string;
  dueId?: string;
  tenantId?: string;
  receiptNumber?: string;
  forMonthYear?: string;
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
  status: 'draft' | 'payout_completed' | 'reverted' | string;
  isCancelled?: boolean;
  signedByOwner: boolean;
  signatureDate?: string;
  createdAt: string;
}

export interface RePropertyExpense {
  id: string;
  propertyId: string;
  propertyName?: string;
  ownerId: string;
  ownerName?: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
  forMonthYear?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  recordedBy?: string;
  isDeducted?: boolean;
  deductedAt?: string;
  deductedBy?: string;
  unDeductedAt?: string;
  unDeductedBy?: string;
  createdAt: string;
}

export interface ReAdvanceDeductionEntry {
  id: string;
  amount: number;
  deductionDate: string;
  deductionMethod: string; // 'خصم من المستحق' | 'نقدي' | 'تحويل بنكي'
  deductionRef?: string;
  deductionNotes?: string;
  deductedBy?: string;
  createdAt: string;
}

export interface ReOwnerAdvance {
  id: string;
  ownerId: string;
  ownerName?: string;
  propertyId: string;
  propertyName?: string;
  amount: number;
  advanceDate: string;
  forMonthYear?: string;
  notes: string;
  paymentMethod?: string;
  isDeducted: boolean;
  deductedAt?: string;
  deductedBy?: string;
  deductedAmount?: number;
  remainingAmount?: number;
  deductionMethod?: string; // 'خصم من المستحق' | 'سداد نقدي' | 'تحويل بنكي' | 'اتصالات كاش' | 'فودافون كاش'
  deductionDate?: string;
  deductionRef?: string;
  deductionNotes?: string;
  deductions?: ReAdvanceDeductionEntry[];
  unDeductedAt?: string;
  unDeductedBy?: string;
  recordedBy?: string;
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
  contractStartDate?: string;
  contractEndDate?: string;
  
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
  collectionStatus?: 'pending_collection' | 'collected' | 'overdue' | 'prepaid';
  isPrepaid?: boolean;
  monthClosingStatus?: 'open' | 'balanced' | 'closed';
  
  // Collection details
  collectionReceiptId?: string;
  collectedAmount?: number;
  paidDate?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  collectedBy?: string;
  collectionNotes?: string;
  lastRevertDate?: string;
  
  // Payout details
  payoutId?: string;
  payoutAmount?: number;
  payoutDate?: string;
  payoutMethod?: string;
  payoutRefNo?: string;
  payoutReceiptNumber?: string;
  payoutNotes?: string;
  payoutRecordedBy?: string;

  // Closing details
  closedBy?: string;
  closedAt?: string;

  // Rent manual adjustment tracking
  isAdjusted?: boolean;
  adjustedRentAmount?: number;
  
  updatedAt?: string;
  createdAt: string;
}

export interface ReRentAdjustment {
  id: string; // e.g. `adj_${tenantId}_${forMonthYear}`
  tenantId: string;
  tenantName?: string;
  unitId?: string;
  propertyId?: string;
  forMonthYear: string; // e.g. "2026-08"
  adjustedRentAmount: number;
  originalRentAmount?: number;
  commissionType?: 'percentage' | 'fixed_per_thousand' | 'fixed_flat';
  commissionValue?: number;
  commissionAmount?: number;
  netOwnerAmount?: number;
  notes?: string;
  updatedAt: string;
}

export interface ReCommissionStatus {
  id: string; // e.g. `${propertyId}_${forMonthYear}`
  propertyId: string;
  propertyName?: string;
  ownerId?: string;
  ownerName?: string;
  dueId?: string;
  tenantId?: string;
  forMonthYear: string; // e.g. "2026-07"
  status?: 'not_claimed' | 'claimed' | 'collected' | 'overdue' | 'uncollected' | string;
  isCollectedFromOwner: boolean;
  amountCollectedFromOwner?: number;
  collectionDate?: string;
  paymentMethod?: 'cash' | 'bank_transfer' | 'check' | 'other' | string;
  referenceNumber?: string;
  paidAmount?: number;
  isPaid?: boolean;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  const isAdmin = role === 'admin';
  const isLawyer = role === 'lawyer';
  const isSecretary = role === 'secretary';
  const isEmployee = role === 'employee';

  return {
    // Cases
    viewCases: true,
    addCase: !isEmployee,
    editCase: !isEmployee,
    deleteCase: isAdmin || isLawyer,
    archiveCase: isAdmin || isLawyer,
    restoreCase: isAdmin,
    printCase: true,

    // Companies
    viewCompanies: true,
    addCompany: !isEmployee,
    editCompany: !isEmployee,
    deleteCompany: isAdmin || isLawyer,
    archiveCompany: isAdmin || isLawyer,
    restoreCompany: isAdmin,
    printCompany: true,

    // Clients
    viewClients: true,
    addClient: true,
    editClient: true,
    deleteClient: isAdmin || isLawyer,

    // Sessions & Agenda
    viewAgenda: true,
    addAgendaHearing: !isEmployee,
    editAgendaHearing: !isEmployee,
    deleteAgendaHearing: isAdmin || isLawyer,
    addSession: !isEmployee,
    editSession: !isEmployee,
    deleteSession: isAdmin || isLawyer,
    recordSessionDecision: true,
    editSessionDecision: !isEmployee,

    // Real Estate & Rental Collection
    viewRealEstate: isAdmin || isLawyer || isSecretary || isEmployee,
    addRealEstate: !isEmployee,
    addRealEstateProperty: !isEmployee,
    editRealEstate: !isEmployee,
    editRealEstateProperty: !isEmployee,
    deleteRealEstate: isAdmin,
    deleteRealEstateProperty: isAdmin,
    addRealEstateContract: !isEmployee,
    editRealEstateContract: !isEmployee,
    collectRent: true,
    collectRealEstateRent: true,
    reverseCollectRent: isAdmin || isLawyer,
    rollbackRealEstateCollection: isAdmin || isLawyer,
    payoutOwner: isAdmin || isLawyer,
    disburseOwnerPayment: isAdmin || isLawyer,
    reversePayoutOwner: isAdmin,
    addRealEstateExpense: true,
    manageOwnerAdvances: isAdmin || isLawyer,
    printRealEstateReports: true,

    // General Archive & Deleted Records
    viewArchive: isAdmin || isLawyer || isSecretary,
    deleteArchive: isAdmin,

    // Experts & Referrals
    viewExperts: isAdmin || isLawyer || isSecretary,
    manageExperts: isAdmin || isLawyer,

    // Investigations & Legal Reports
    viewInvestigationReports: isAdmin || isLawyer || isSecretary,

    // Documents
    uploadDoc: true,
    downloadDoc: true,
    deleteDoc: isAdmin || isLawyer,
    printDoc: true,

    // Fees
    viewFees: isAdmin || isLawyer || isSecretary,
    addReceipt: isAdmin || isLawyer || isSecretary,
    editFees: isAdmin,
    deleteFees: isAdmin || isLawyer,

    // Reports
    viewReports: isAdmin || isLawyer,
    printReports: isAdmin || isLawyer,
    exportPdf: isAdmin || isLawyer,
    exportExcel: isAdmin,

    // System Management & Backup/Restore
    manageUsers: isAdmin,
    manageSettings: isAdmin,
    viewBackup: isAdmin,
    backupSystemData: isAdmin,
    restoreBackup: isAdmin,
    restoreSystemData: isAdmin,

    // Tasks
    viewTasks: true,
    addTask: true,
    editTask: !isEmployee,
    deleteTask: isAdmin,
    assignTask: isAdmin || isLawyer,
    reassignTask: isAdmin || isLawyer,
    changeTaskStatus: true,
    sendTaskWhatsapp: true,
    viewAllTasks: isAdmin || isLawyer,
    viewOwnTasksOnly: isEmployee,
    approveTaskCompletion: isAdmin || isLawyer,
    reopenTask: isAdmin || isLawyer,
    manageTasks: isAdmin,
    viewUserTaskTracking: true,
    viewTaskExecutionTracking: isAdmin
  };
}

export function sanitizeAndMigrateUserPermissions(user: User): User {
  if (!user) return user;
  
  const defaults = getDefaultPermissionsForRole(user.role);
  const existingPerms = user.permissions || ({} as UserPermissions);

  const mergedPerms: UserPermissions = {
    ...defaults,
    ...existingPerms
  };

  // Sync alias keys
  if (mergedPerms.viewRealEstate === undefined && (mergedPerms as any).viewRealEstateProperty !== undefined) {
    mergedPerms.viewRealEstate = (mergedPerms as any).viewRealEstateProperty;
  }
  if (mergedPerms.collectRent !== undefined) {
    mergedPerms.collectRealEstateRent = mergedPerms.collectRent;
  }
  if (mergedPerms.reverseCollectRent !== undefined) {
    mergedPerms.rollbackRealEstateCollection = mergedPerms.reverseCollectRent;
  }
  if (mergedPerms.payoutOwner !== undefined) {
    mergedPerms.disburseOwnerPayment = mergedPerms.payoutOwner;
  }
  if (mergedPerms.viewBackup !== undefined) {
    mergedPerms.backupSystemData = mergedPerms.viewBackup;
  }
  if (mergedPerms.restoreBackup !== undefined) {
    mergedPerms.restoreSystemData = mergedPerms.restoreBackup;
  }

  // Super Admin always has true for all permission flags
  if (user.role === 'admin' || user.id === 'user-admin') {
    Object.keys(mergedPerms).forEach(k => {
      (mergedPerms as any)[k] = true;
    });
  }

  return {
    ...user,
    permissions: mergedPerms
  };
}


