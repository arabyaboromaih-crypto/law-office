/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Case, Client, Company, HearingSession, AuditLog, LegalTask } from './types';

export const initialUsers: User[] = [
  {
    id: 'user-lawyer-1',
    fullName: 'الأستاذ محمود الشافعي',
    phone: '01234567890',
    username: 'mahmoud',
    email: 'mahmoud@romeih-law.com',
    role: 'lawyer',
    title: 'محامٍ بالاستئناف العالي',
    hireDate: '2019-06-15',
    status: 'active',
    avatarUrl: '',
    permissions: {
      viewCases: true, addCase: true, editCase: true, deleteCase: false, archiveCase: true, restoreCase: false, printCase: true,
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: false, archiveCompany: true, restoreCompany: false, printCompany: true,
      viewClients: true, addClient: true, editClient: true, deleteClient: false,
      addSession: true, editSession: true, deleteSession: false, recordSessionDecision: true, editSessionDecision: true,
      uploadDoc: true, downloadDoc: true, deleteDoc: false, printDoc: true,
      viewFees: true, addReceipt: true, editFees: false, deleteFees: false,
      viewReports: true, printReports: true, exportPdf: true, exportExcel: false,
      manageUsers: false,
      manageTasks: false, viewUserTaskTracking: true, viewTaskExecutionTracking: false
    },
    forcePasswordChange: false,
    password: '01234567890'
  },
  {
    id: 'user-lawyer-2',
    fullName: 'الأستاذة ياسمين صبري',
    phone: '01122334455',
    username: 'yasmin',
    email: 'yasmin@romeih-law.com',
    role: 'lawyer',
    title: 'محامية نقض ودستورية عليا',
    hireDate: '2018-02-01',
    status: 'active',
    avatarUrl: '',
    permissions: {
      viewCases: true, addCase: true, editCase: true, deleteCase: false, archiveCase: true, restoreCase: false, printCase: true,
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: false, archiveCompany: true, restoreCompany: false, printCompany: true,
      viewClients: true, addClient: true, editClient: true, deleteClient: false,
      addSession: true, editSession: true, deleteSession: false, recordSessionDecision: true, editSessionDecision: true,
      uploadDoc: true, downloadDoc: true, deleteDoc: false, printDoc: true,
      viewFees: true, addReceipt: true, editFees: false, deleteFees: false,
      viewReports: true, printReports: true, exportPdf: true, exportExcel: true,
      manageUsers: false,
      manageTasks: false, viewUserTaskTracking: true, viewTaskExecutionTracking: false
    },
    forcePasswordChange: false,
    password: '01122334455'
  },
  {
    id: 'user-sec-1',
    fullName: 'الأستاذة مروة فاروق',
    phone: '01555544433',
    username: 'marwa',
    email: 'marwa@romeih-law.com',
    role: 'secretary',
    title: 'سكرتيرة إدارية ومنسقة جلسات',
    hireDate: '2021-10-01',
    status: 'active',
    avatarUrl: '',
    permissions: {
      viewCases: true, addCase: true, editCase: true, deleteCase: false, archiveCase: false, restoreCase: false, printCase: true,
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: false, archiveCompany: false, restoreCompany: false, printCompany: true,
      viewClients: true, addClient: true, editClient: true, deleteClient: false,
      addSession: true, editSession: true, deleteSession: false, recordSessionDecision: true, editSessionDecision: true,
      uploadDoc: true, downloadDoc: true, deleteDoc: false, printDoc: true,
      viewFees: true, addReceipt: true, editFees: false, deleteFees: false,
      viewReports: true, printReports: true, exportPdf: false, exportExcel: false,
      manageUsers: false,
      manageTasks: false, viewUserTaskTracking: true, viewTaskExecutionTracking: false
    },
    forcePasswordChange: false,
    password: '01555544433'
  },
  {
    id: 'user-admin-arabi',
    fullName: 'الأستاذ / عربي رميح',
    phone: '01143472682',
    username: 'عربي رميح',
    email: 'arabyaboromaih@gmail.com',
    role: 'admin',
    title: 'المدير العام',
    hireDate: '1993-01-01',
    status: 'active',
    avatarUrl: '',
    permissions: {
      viewCases: true, addCase: true, editCase: true, deleteCase: true, archiveCase: true, restoreCase: true, printCase: true,
      viewCompanies: true, addCompany: true, editCompany: true, deleteCompany: true, archiveCompany: true, restoreCompany: true, printCompany: true,
      viewClients: true, addClient: true, editClient: true, deleteClient: true,
      addSession: true, editSession: true, deleteSession: true, recordSessionDecision: true, editSessionDecision: true,
      uploadDoc: true, downloadDoc: true, deleteDoc: true, printDoc: true,
      viewFees: true, addReceipt: true, editFees: true, deleteFees: true,
      viewReports: true, printReports: true, exportPdf: true, exportExcel: true,
      manageUsers: true,
      manageSettings: true,
      manageTasks: true, viewUserTaskTracking: true, viewTaskExecutionTracking: true,
      viewTasks: true, addTask: true, editTask: true, deleteTask: true, assignTask: true, reassignTask: true, changeTaskStatus: true, sendTaskWhatsapp: true, viewAllTasks: true, viewOwnTasksOnly: false, approveTaskCompletion: true, reopenTask: true
    },
    forcePasswordChange: false,
    password: '1993'
  }
];

export const initialClients: Client[] = [
  {
    id: 'client-1',
    name: 'حامد زكريا عبد اللطيف',
    nationalId: '28509140102345',
    phone: '01011112222',
    secondaryPhone: '01222223333',
    email: 'hamed@gmail.com',
    address: '15 شارع قصر العيني، الشقة 4، القاهرة',
    job: 'مهندس استشاري حر',
    notes: 'موكل دائم في قضايا عقارية وتجارية لمجموعته الاستثمارية.'
  },
  {
    id: 'client-2',
    name: 'عصام رأفت أبو الوفا',
    nationalId: '29007220205678',
    phone: '01144445555',
    email: 'essam.raafat@outlook.com',
    address: '45 عمارات العبور، طريق صلاح سالم، نصر سيتي، القاهرة',
    job: 'مدير عام مبيعات بشركة استيراد',
    notes: 'لديه نزاع عمالي مع شركته السابقة، ونزاع آخر حول شقة إيجار قديم.'
  },
  {
    id: 'client-3',
    name: 'سعاد جلال الشربيني',
    nationalId: '27512050109876',
    phone: '01555551111',
    address: '9 حي الأندلس، التجمع الخامس، القاهرة الجديدة',
    job: 'سيدة أعمال ومساهمة عقارية',
    notes: 'قضية نفقة وأحوال شخصية ضد طليقها وقضية رؤية أطفال.'
  },
  {
    id: 'client-4',
    name: 'شركة النيل للتشييد والتعمير',
    nationalId: '100452319', // السجل الضريبي/التجاري كمثال
    phone: '0223456789',
    secondaryPhone: '01009876543',
    email: 'info@nile-construction.eg',
    address: 'المنطقة الصناعية الثالثة، السادس من أكتوبر، الجيزة',
    job: 'شركة مساهمة مصرية مقاولات',
    notes: 'نتابع كافة نزاعاتها وعقود التأسيس والتحكيم التجاري الخاص بها.',
    companyId: 'company-1'
  }
];

export const initialCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'شركة النيل للتشييد والتعمير',
    commercialRegister: '78234 قاهرة',
    taxCard: '512-894-315',
    vatCertificate: 'ق م 41029',
    activityType: 'مقاولات عمومية وتطوير عقاري وبنية تحتية',
    address: 'المنطقة الصناعية الثالثة، السادس من أكتوبر، الجيزة',
    phone: '0223456789',
    partners: [
      {
        name: 'م. حازم المنياوي',
        participationPercentage: 60,
        shareValue: 6000000,
        nationalId: '27805120104321',
        phone: '01003334444',
        address: 'فيلا 3، حي الياسمين، التجمع الأول'
      },
      {
        name: 'أ. طارق عبد الخالق',
        participationPercentage: 40,
        shareValue: 4000000,
        nationalId: '28203190105678',
        phone: '01225556666',
        address: 'شقة 12، برج الصفوة، المعادي'
      }
    ],
    documents: [
      { id: 'cd-1', name: 'عقد تأسيس الشركة المعدل 2024', type: 'pdf', uploadDate: '2024-03-12', fileUrl: '#' },
      { id: 'cd-2', name: 'مستخرج حديث من السجل التجاري', type: 'pdf', uploadDate: '2026-01-10', fileUrl: '#' },
      { id: 'cd-3', name: 'صورة البطاقة الضريبية المجددة', type: 'image', uploadDate: '2025-05-18', fileUrl: '#' }
    ],
    isArchived: false
  },
  {
    id: 'company-2',
    name: 'المؤسسة المتحدة للصناعات البلاستيكية (مؤرشفة)',
    commercialRegister: '90123 جيزة',
    taxCard: '304-712-441',
    activityType: 'تصنيع وتصدير البلاستيك والخراطيم',
    address: 'المنطقة الحرة بمدينة العامرية، الإسكندرية',
    phone: '034509123',
    partners: [
      {
        name: 'أحمد رأفت الهواري',
        participationPercentage: 100,
        shareValue: 2000000,
        nationalId: '27501010103214',
        phone: '01008765432',
        address: 'سموحة، الإسكندرية'
      }
    ],
    documents: [
      { id: 'cd-4', name: 'عقد الفسخ والتصفية الاختيارية', type: 'pdf', uploadDate: '2025-11-20', fileUrl: '#' }
    ],
    isArchived: true,
    archiveDate: '2025-12-01',
    archiveReason: 'تصفية الشركة',
    archiveNotes: 'تمت تصفية أصول الشركة بالكامل وسداد كافة المستحقات للضرائب والتأمينات وفض الشراكة بموجب العقد المؤرخ.'
  }
];

export const initialCases: Case[] = [
  {
    id: 'case-1',
    caseNumberFirstInstance: '14205',
    caseYearFirstInstance: '2025',
    caseNumberSecondInstance: '3410',
    caseYearSecondInstance: '2026',
    type: 'جنح',
    court: 'محكمة جنح مستأنف قصر النيل',
    circuit: 'الدائرة 5 مستأنف',
    nextHearingDate: '2026-06-26', // Today (using metadata date 2026-06-26)
    status: 'مؤجلة للاطلاع وتقديم المستندات',
    clientName: 'عصام رأفت أبو الوفا',
    clientId: 'client-2',
    opponent: {
      name: 'شركة النور للخدمات اللوجستية',
      role: 'متهم بالتبديد (الخصم)',
      address: '22 شارع طلعت حرب، وسط البلد، القاهرة',
      lawyer: 'أ. جابر الهلالي',
      phone: '01015151515',
      notes: 'النزاع بخصوص خيانة أمانة وإيصالات أمانة مستحقة للعميل.'
    },
    notes: 'القضية هامة وتتطلب مذكرات دفاع بخصوص ركن التسليم المادي المفقود في إيصال الأمانة.',
    prosecutorName: 'أ. حسام الدين (وكيل نيابة قصر النيل)',
    enforcementNumber: 'حصر 392 لسنة 2025',
    degree: 'استئناف',
    totalFees: 30000,
    paidFees: 12000,
    remainingFees: 18000,
    payments: [
      { id: 'pay-1', amount: 5000, date: '2025-11-10', receiptNumber: 'سند رقم 1024', notes: 'مقدم أتعاب القضية والتوكيل' },
      { id: 'pay-2', amount: 7000, date: '2026-03-15', receiptNumber: 'سند رقم 1245', notes: 'قسط جلسة أول درجة' }
    ],
    files: [
      { id: 'f-1', name: 'أصل إيصال الأمانة المطعون فيه', type: 'image', category: 'مستندات رسمية', uploadDate: '2025-11-12', size: '2.4 MB', fileUrl: '#' },
      { id: 'f-2', name: 'تقرير الطب الشرعي بخصوص الخط والتوقيع', type: 'pdf', category: 'مستندات رسمية', uploadDate: '2026-02-18', size: '1.8 MB', fileUrl: '#' },
      { id: 'f-3', name: 'مذكرة دفاعنا المودعة بجلسة أول درجة', type: 'word', category: 'مذكرات', uploadDate: '2026-03-01', size: '320 KB', fileUrl: '#' }
    ],
    isArchived: false,
    assignedLawyerId: 'user-lawyer-1'
  },
  {
    id: 'case-2',
    caseNumberFirstInstance: '4502',
    caseYearFirstInstance: '2024',
    type: 'مدني',
    court: 'محكمة شمال القاهرة الإبتدائية',
    circuit: 'الدائرة 14 مدني كلي',
    nextHearingDate: '2026-06-27', // Tomorrow
    status: 'محجوزة للحكم بجلسة الغد',
    clientName: 'حامد زكريا عبد اللطيف',
    clientId: 'client-1',
    opponent: {
      name: 'عبد الحميد بكري شاهين',
      role: 'مدعى عليه',
      address: '7 شارع النزهة، مصر الجديدة، القاهرة',
      lawyer: 'أ. فوزي الشال',
      phone: '01222998811',
      notes: 'دعوى فسخ عقد بيع واسترداد عربون مع التعويض.'
    },
    notes: 'قمنا بإثبات إخلال الخصم بالتزامات التعاقد وامتناعه عن تسليم الأرض الشاغرة.',
    degree: 'أول درجة',
    totalFees: 50000,
    paidFees: 35000,
    remainingFees: 15000,
    payments: [
      { id: 'pay-3', amount: 15000, date: '2024-05-20', receiptNumber: 'سند رقم 841', notes: 'مقدم الأتعاب وبدء اتخاذ الإجراءات' },
      { id: 'pay-4', amount: 20000, date: '2025-01-12', receiptNumber: 'سند رقم 998', notes: 'دفعة ثانية بعد تقرير خبير وزارة العدل' }
    ],
    files: [
      { id: 'f-4', name: 'عقد البيع الابتدائي المؤرخ 2023', type: 'pdf', category: 'صحف الدعاوى', uploadDate: '2024-05-22', size: '4.1 MB', fileUrl: '#' },
      { id: 'f-5', name: 'تقرير خبير وزارة العدل المودع بملف الدعوى', type: 'pdf', category: 'مستندات رسمية', uploadDate: '2025-11-05', size: '12.4 MB', fileUrl: '#' }
    ],
    isArchived: false,
    assignedLawyerId: 'user-lawyer-2'
  },
  {
    id: 'case-3',
    caseNumberFirstInstance: '7840',
    caseYearFirstInstance: '2026',
    type: 'أحوال شخصية',
    court: 'محكمة أسرة التجمع الخامس',
    circuit: 'الدائرة 2 أسرة',
    nextHearingDate: '2026-07-02', // Next week
    status: 'مؤجلة للصلح أمام الخبراء النفسيين والاجتماعيين',
    clientName: 'سعاد جلال الشربيني',
    clientId: 'client-3',
    opponent: {
      name: 'أشرف عبد الفتاح غانم',
      role: 'مدعى عليه (مطلق)',
      address: 'فيلا 18، غرب أربيل، الشروق',
      lawyer: 'أ. رأفت الشاذلي',
      phone: '01123450000',
      notes: 'نزاع حول مصاريف مدرسة الأبناء الدولية والنفقة الشهرية.'
    },
    notes: 'الموكلة ترفض أي تسوية مادية تقل عن 20 ألف جنيه شهرياً للأولاد.',
    degree: 'أول درجة',
    totalFees: 20000,
    paidFees: 20000,
    remainingFees: 0,
    payments: [
      { id: 'pay-5', amount: 20000, date: '2026-01-15', receiptNumber: 'سند رقم 1201', notes: 'سداد كامل الأتعاب المتفق عليها شاملة الحضور والخبراء' }
    ],
    files: [
      { id: 'f-6', name: 'شهادات ميلاد الأبناء وبطاقة الموكلة', type: 'image', category: 'مستندات رسمية', uploadDate: '2026-01-16', size: '1.2 MB', fileUrl: '#' },
      { id: 'f-7', name: 'بيان مفردات مرتب الزوج من بنك قطر الوطني', type: 'pdf', category: 'مستندات رسمية', uploadDate: '2026-02-28', size: '1.5 MB', fileUrl: '#' }
    ],
    isArchived: false,
    assignedLawyerId: 'user-lawyer-2'
  },
  {
    id: 'case-4',
    caseNumberFirstInstance: '11052',
    caseYearFirstInstance: '2023',
    caseNumberSecondInstance: '5920',
    caseYearSecondInstance: '2024',
    type: 'مجلس الدولة',
    court: 'محكمة القضاء الإداري ببنها',
    circuit: 'الدائرة الأولى تسويات',
    status: 'مؤرشفة - صدر حكم نهائي لصالح الموكل بالتعويض',
    clientName: 'حامد زكريا عبد اللطيف',
    clientId: 'client-1',
    opponent: {
      name: 'محافظ القليوبية بصفته',
      role: 'مدعى عليه بصفته',
      address: 'ديوان عام محافظة القليوبية، بنها',
      lawyer: 'هيئة قضايا الدولة',
      phone: '0133221100',
      notes: 'دعوى إلغاء قرار إداري بنزع ملكية للمنفعة العامة بدون تعويض عادل.'
    },
    notes: 'تم الطعن في قرار نزع الملكية وربحنا القضية بحكم يقضي بصرف 3.5 مليون جنيه تعويض إضافي للموكل.',
    degree: 'استئناف',
    totalFees: 80000,
    paidFees: 80000,
    remainingFees: 0,
    payments: [
      { id: 'pay-6', amount: 40000, date: '2023-09-10', receiptNumber: 'سند رقم 610', notes: 'الدفعة الأولى' },
      { id: 'pay-7', amount: 40000, date: '2024-11-28', receiptNumber: 'سند رقم 1109', notes: 'دفعة الانجاز واستلام الحكم البات' }
    ],
    files: [
      { id: 'f-8', name: 'الحكم الصادر بإلغاء القرار الإداري والتعويض', type: 'pdf', category: 'أحكام', uploadDate: '2024-11-20', size: '3.6 MB', fileUrl: '#' }
    ],
    isArchived: true,
    archiveDate: '2025-01-15',
    archiveReason: 'صدر حكم نهائي',
    archiveNotes: 'الحكم نهائي وبات وحصلنا على الصيغة التنفيذية وتم الصرف بالكامل وإيداع المبالغ بحساب الموكل وإغلاق الملف إدارياً بالمؤسسة.',
    assignedLawyerId: 'user-lawyer-1'
  }
];

export const initialSessions: HearingSession[] = [
  {
    id: 'session-1',
    caseId: 'case-1',
    caseNumber: '14205',
    caseYear: '2025',
    clientName: 'عصام رأفت أبو الوفا',
    opponentName: 'شركة النور للخدمات اللوجستية',
    court: 'محكمة جنح مستأنف قصر النيل',
    circuit: 'الدائرة 5 مستأنف',
    type: 'جنح',
    date: '2026-06-26', // Today (using metadata date)
    time: '09:30',
    subject: 'مرافعة دفاع وتقديم مستندات السداد العيني',
    status: 'pending',
    assignedLawyerId: 'user-lawyer-1',
    assignedLawyerName: 'الأستاذ محمود الشافعي',
    notes: 'الحضور ضروري ومعنا أصل الشهادة المصاحبة لتقرير الخبير.'
  },
  {
    id: 'session-2',
    caseId: 'case-2',
    caseNumber: '4502',
    caseYear: '2024',
    clientName: 'حامد زكريا عبد اللطيف',
    opponentName: 'عبد الحميد بكري شاهين',
    court: 'محكمة شمال القاهرة الإبتدائية',
    circuit: 'الدائرة 14 مدني كلي',
    type: 'مدني',
    date: '2026-06-27', // Tomorrow
    time: '10:00',
    subject: 'النطق بالحكم النهائي في الشق الموضوعي لفسخ العقد',
    status: 'pending',
    assignedLawyerId: 'user-lawyer-2',
    assignedLawyerName: 'الأستاذة ياسمين صبري',
    notes: 'متابعة الرول والنطق بالحكم وإثبات المنطوق بمسودة فورية.'
  },
  {
    id: 'session-3',
    caseId: 'case-3',
    caseNumber: '7840',
    caseYear: '2026',
    clientName: 'سعاد جلال الشربيني',
    opponentName: 'أشرف عبد الفتاح غانم',
    court: 'محكمة أسرة التجمع الخامس',
    circuit: 'الدائرة 2 أسرة',
    type: 'أحوال شخصية',
    date: '2026-07-02', // Next week
    time: '11:15',
    subject: 'عرض الصلح الثاني أمام نيابة الأسرة والخبراء',
    status: 'pending',
    assignedLawyerId: 'user-lawyer-2',
    assignedLawyerName: 'الأستاذة ياسمين صبري',
    notes: 'إحضار الموكلة للتأكيد على موقفها الرافض للمبالغ المتدنية المقترحة.'
  }
];

export const initialLogs: AuditLog[] = [
  {
    id: 'log-1',
    username: '01012345678',
    fullName: 'الأستاذ عربي رميح',
    timestamp: '2026-06-26T08:15:00',
    deviceInfo: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0',
    actionType: 'login',
    details: 'تم تسجيل دخول مدير المؤسسة بنجاح.'
  },
  {
    id: 'log-2',
    username: '01234567890',
    fullName: 'الأستاذ محمود الشافعي',
    timestamp: '2026-06-26T09:00:22',
    deviceInfo: 'Android Mobile - Safari App',
    actionType: 'login',
    details: 'تسجيل دخول المحامي محمود الشافعي لمراجعة جلسة اليوم.'
  }
];

export const initialTasks: LegalTask[] = [
  {
    id: 'task-1',
    taskNumber: 'TSK-2026-0001',
    title: 'إعداد مذكرة دفاع في قضية النزاع المدني للشركة المصرية للأغذية',
    description: 'يجب إعداد مذكرة دفاع قوية تتضمن الدفوع القانونية المناسبة ومراجعة كافة عقود التوريد المرفقة بالملف للتأكيد على عدم مسؤولية الموكل عن التأخر في التسليم.',
    type: 'إعداد مذكرة',
    priority: 'عالية',
    createdAt: '2026-06-25T10:00:00Z',
    executionDate: '2026-06-29',
    executionTime: '09:00',
    dueDate: '2026-06-30',
    assignedToId: 'user-lawyer-1',
    assignedToName: 'الأستاذ محمود الشافعي',
    clientId: 'client-1',
    clientName: 'أحمد رأفت التهامي',
    caseId: 'case-1',
    caseNumber: '1254',
    companyId: 'comp-1',
    companyName: 'الشركة المصرية للتوريدات والأغذية',
    notes: 'يرجى التركيز على المادة 147 من القانون المدني الخاصة بالظروف الطارئة.',
    status: 'قيد التنفيذ',
    attachments: [
      {
        id: 'attach-1-1',
        name: 'تقرير الخبير الاستشاري المبدئي',
        type: 'PDF',
        uploadDate: '2026-06-25',
        uploadedBy: 'الأستاذ عربي رميح',
        fileUrl: '#',
        size: '2.4 MB'
      }
    ],
    followUps: [
      {
        id: 'followup-1-1',
        date: '2026-06-26',
        time: '11:30',
        username: 'الأستاذ محمود الشافعي',
        action: 'تجميع مستندات ومراجعة نصوص القانون',
        notes: 'تمت مراجعة شروط عقد التوريد وتبين وجود ثغرة في بند القوة القاهرة سيتم توظيفها في المذكرة.',
        attachments: []
      }
    ],
    whatsappLogs: [
      {
        id: 'wlog-1-1',
        sentAt: '2026-06-25T10:15:00Z',
        sentBy: 'الأستاذ عربي رميح',
        recipientPhone: '01234567890',
        recipientName: 'الأستاذ محمود الشافعي'
      }
    ]
  },
  {
    id: 'task-2',
    taskNumber: 'TSK-2026-0002',
    title: 'حضور جلسة صحة التوقيع أمام محكمة حلوان الجزئية',
    description: 'تمثيل الموكلة سعاد جلال وتقديم أصل عقد البيع وشهادة الشهود المدونة بالملف.',
    type: 'حضور جلسة',
    priority: 'عاجلة',
    createdAt: '2026-06-26T12:00:00Z',
    executionDate: '2026-07-02',
    executionTime: '10:30',
    dueDate: '2026-07-02',
    assignedToId: 'user-lawyer-2',
    assignedToName: 'الأستاذة ياسمين صبري',
    clientId: 'client-2',
    clientName: 'سعاد جلال الشربيني',
    caseId: 'case-3',
    caseNumber: '7840',
    notes: 'أصل العقد موجود بخزنة المكتب، يرجى التنسيق مع سكرتارية الجلسات لاستلامه صباح الجلسة.',
    status: 'جديدة',
    attachments: [],
    followUps: [],
    whatsappLogs: []
  },
  {
    id: 'task-3',
    taskNumber: 'TSK-2026-0003',
    title: 'مراجعة وتعديل عقود تأسيس شركة جلوبال سوليوشنز للتكنولوجيا',
    description: 'تعديل غرض الشركة في العقد وإضافة نشاط تجارة الأجهزة الذكية والاستيراد والتصدير مع التأكد من مطابقة البنود لقانون الشركات رقم 159 لسنة 1981.',
    type: 'تأسيس شركة',
    priority: 'متوسطة',
    createdAt: '2026-06-27T09:00:00Z',
    executionDate: '2026-06-28',
    executionTime: '13:00',
    dueDate: '2026-07-05',
    assignedToId: 'user-lawyer-1',
    assignedToName: 'الأستاذ محمود الشافعي',
    companyId: 'comp-2',
    companyName: 'شركة جلوبال تكنولوجي سوليوشنز',
    notes: 'الشركاء يرغبون في تحديد حصصهم بالتساوي بنسبة 50% لكل شريك.',
    status: 'بانتظار مستندات',
    attachments: [
      {
        id: 'attach-3-1',
        name: 'مسودة عقد التأسيس المقترح',
        type: 'Word',
        uploadDate: '2026-06-27',
        uploadedBy: 'الأستاذ عربي رميح',
        fileUrl: '#',
        size: '1.1 MB'
      }
    ],
    followUps: [
      {
        id: 'followup-3-1',
        date: '2026-06-27',
        time: '14:00',
        username: 'الأستاذ محمود الشافعي',
        action: 'التواصل مع الشركاء لطلب مستندات التوكيلات',
        notes: 'تم إبلاغ الشركاء بضرورة إرسال صور توكيلاتهم الرسمية سارية المفعول حتى نتمكن من السير في إجراءات الشهر العقاري.',
        attachments: []
      }
    ],
    whatsappLogs: []
  }
];

