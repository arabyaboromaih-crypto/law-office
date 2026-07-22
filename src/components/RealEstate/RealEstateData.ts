import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, ReRealEstateLog, ReRentDue 
} from '../../types';

// Default initial data for testing/seeding
export const initialOwners: ReOwner[] = [
  {
    id: 'owner-1',
    name: 'الحاج أحمد عبد الرحمن الرميح',
    phone: '01012345678',
    email: 'ahmed.romeih@example.com',
    commissionType: 'percentage',
    commissionValue: 5, // 5%
    bankAccount: 'EG1200030005000012345678901',
    paymentMethod: 'تحويل بنكي - البنك الأهلي المصري',
    notes: 'أكبر ملاك المجموعة، يمتلك البرج السكني ويسوى حسابه في نهاية كل شهر ميلادي.',
    createdAt: '2026-01-01'
  },
  {
    id: 'owner-2',
    name: 'الأستاذ كمال محمد الشناوي',
    phone: '01223456789',
    email: 'kamal.shinawi@example.com',
    commissionType: 'fixed_per_thousand',
    commissionValue: 50, // 50 EGP per 1000 EGP collected (5%)
    bankAccount: 'EG4500020004000098765432101',
    paymentMethod: 'تحويل فودافون كاش / إنستاباي',
    notes: 'مالك المجمع التجاري، تسليم مستحقاته يتم فورياً بعد التحصيل بحد أقصى يومين.',
    createdAt: '2026-01-05'
  }
];

export const initialProperties: ReProperty[] = [
  {
    id: 'prop-1',
    ownerId: 'owner-1',
    name: 'برج الرميح السكني (أ)',
    address: 'شارع التسعين الشمالي، التجمع الخامس، القاهرة',
    floorsCount: 8,
    unitsCount: 16,
    status: 'active',
    notes: 'برج سكني فاخر مزود بحراسة وكاميرات مراقبة ومصعد حديث.',
    createdAt: '2026-01-02'
  },
  {
    id: 'prop-2',
    ownerId: 'owner-2',
    name: 'مجمع الشناوي التجاري والإداري',
    address: 'محور شينزو آبي، مدينة نصر، القاهرة',
    floorsCount: 3,
    unitsCount: 6,
    status: 'active',
    notes: 'مجمع تجاري يضم محلات تجارية في الدور الأرضي ومكاتب إدارية في الأدوار العلوية.',
    createdAt: '2026-01-06'
  }
];

export const initialUnits: ReUnit[] = [
  // tower 1 units
  {
    id: 'unit-101',
    propertyId: 'prop-1',
    unitNumber: '101',
    floor: 1,
    activityType: 'residential',
    rentValue: 6500,
    dueDay: 5,
    status: 'rented',
    notes: 'شقة سكنية واجهة أمامية.',
    createdAt: '2026-01-02'
  },
  {
    id: 'unit-102',
    propertyId: 'prop-1',
    unitNumber: '102',
    floor: 1,
    activityType: 'residential',
    rentValue: 6000,
    dueDay: 5,
    status: 'rented',
    notes: 'شقة سكنية واجهة خلفية هادئة.',
    createdAt: '2026-01-02'
  },
  {
    id: 'unit-201',
    propertyId: 'prop-1',
    unitNumber: '201',
    floor: 2,
    activityType: 'residential',
    rentValue: 7000,
    dueDay: 5,
    status: 'rented',
    notes: 'مؤجرة لمهندس مغترب.',
    createdAt: '2026-01-02'
  },
  {
    id: 'unit-202',
    propertyId: 'prop-1',
    unitNumber: '202',
    floor: 2,
    activityType: 'residential',
    rentValue: 6800,
    dueDay: 10,
    status: 'vacant',
    notes: 'خالية حالياً وجاري عرضها للإيجار السكني.',
    createdAt: '2026-01-02'
  },
  {
    id: 'unit-301',
    propertyId: 'prop-1',
    unitNumber: '301',
    floor: 3,
    activityType: 'residential',
    rentValue: 7200,
    dueDay: 5,
    status: 'maintenance',
    notes: 'تحت أعمال الصيانة للسباكة والدهانات.',
    createdAt: '2026-01-02'
  },
  // commercial complex units
  {
    id: 'unit-c1',
    propertyId: 'prop-2',
    unitNumber: 'محل 1',
    floor: 0,
    activityType: 'commercial',
    rentValue: 25000,
    dueDay: 1,
    status: 'rented',
    notes: 'صيدلية كبرى بالدور الأرضي - موقع حيوي جداً.',
    createdAt: '2026-01-06'
  },
  {
    id: 'unit-c2',
    propertyId: 'prop-2',
    unitNumber: 'مكتب 201',
    floor: 2,
    activityType: 'administrative',
    rentValue: 12000,
    dueDay: 1,
    status: 'rented',
    notes: 'مكتب للاستشارات الهندسية والتصميم.',
    createdAt: '2026-01-06'
  }
];

export const initialTenants: ReTenant[] = [
  {
    id: 'tenant-1',
    unitId: 'unit-101',
    fullName: 'المهندس محمود شريف الدمرداش',
    phone: '01119876543',
    nationalId: '29304150102543',
    contractStartDate: '2026-01-05',
    contractEndDate: '2027-01-05',
    rentAmount: 6500,
    status: 'active',
    attachments: [
      { id: 'att-1', name: 'عقد_إيجار_محمود_شريف.pdf', fileUrl: '#', type: 'pdf', uploadDate: '2026-01-05' },
      { id: 'att-2', name: 'صورة_البطاقة_الشخصية.jpg', fileUrl: '#', type: 'image', uploadDate: '2026-01-05' }
    ],
    notes: 'ملتزم جداً في مواعيد السداد ويقوم بالتحويل عبر تطبيق إنستاباي.',
    createdAt: '2026-01-05'
  },
  {
    id: 'tenant-2',
    unitId: 'unit-102',
    fullName: 'الدكتور أحمد عبد العزيز السقا',
    phone: '01004561234',
    nationalId: '28809220101487',
    contractStartDate: '2026-02-01',
    contractEndDate: '2028-02-01',
    rentAmount: 6000,
    status: 'active',
    attachments: [
      { id: 'att-3', name: 'عقد_شقة_102_طبيب.pdf', fileUrl: '#', type: 'pdf', uploadDate: '2026-02-01' }
    ],
    notes: 'طبيب بمستشفى جامعة عين شمس، يدفع نقداً في مكتب المحاماة.',
    createdAt: '2026-02-01'
  },
  {
    id: 'tenant-3',
    unitId: 'unit-c1',
    fullName: 'شركة صيدليات مصر ش.م.م (ممثلة بالدكتور عادل غانم)',
    phone: '01551234567',
    nationalId: '100458934', // سجل تجاري
    contractStartDate: '2026-01-01',
    contractEndDate: '2031-01-01',
    rentAmount: 25000,
    status: 'active',
    attachments: [
      { id: 'att-4', name: 'عقد_صيدلية_الشناوي.pdf', fileUrl: '#', type: 'pdf', uploadDate: '2026-01-01' },
      { id: 'att-5', name: 'سجل_تجاري_وبطاقة_ضريبية.pdf', fileUrl: '#', type: 'pdf', uploadDate: '2026-01-01' }
    ],
    notes: 'التحصيل بموجب شيكات ربع سنوية تدفع مقدماً في أول كل ربع.',
    createdAt: '2026-01-01'
  }
];

export const initialCollections: ReCollectionReceipt[] = [
  {
    id: 'receipt-1',
    receiptNumber: 'REC-2026-0001',
    tenantId: 'tenant-1',
    unitId: 'unit-101',
    propertyId: 'prop-1',
    amountPaid: 6500,
    forMonthYear: '2026-06',
    paymentDate: '2026-06-04',
    paymentMethod: 'instapay',
    collectedBy: 'الأستاذ عربي رميح',
    notes: 'تم التحصيل بالكامل عبر تطبيق إنستاباي وتحويله للحساب العام للمكتب.',
    createdAt: '2026-06-04'
  },
  {
    id: 'receipt-2',
    receiptNumber: 'REC-2026-0002',
    tenantId: 'tenant-2',
    unitId: 'unit-102',
    propertyId: 'prop-1',
    amountPaid: 6000,
    forMonthYear: '2026-06',
    paymentDate: '2026-06-06',
    paymentMethod: 'cash',
    collectedBy: 'مكتب المحاماة',
    notes: 'دفع نقداً بالخزينة بموجب إيصال استلام يدوي.',
    createdAt: '2026-06-06'
  },
  {
    id: 'receipt-3',
    receiptNumber: 'REC-2026-0003',
    tenantId: 'tenant-3',
    unitId: 'unit-c1',
    propertyId: 'prop-2',
    amountPaid: 25000,
    forMonthYear: '2026-06',
    paymentDate: '2026-06-01',
    paymentMethod: 'bank_transfer',
    collectedBy: 'الأستاذ عربي رميح',
    notes: 'تحويل بنكي مباشر لحساب المالك كمال الشناوي تحت إشرافنا.',
    createdAt: '2026-06-01'
  }
];

export const initialPayouts: RePayout[] = [
  {
    id: 'payout-1',
    ownerId: 'owner-1',
    totalCollected: 12500, // 6500 + 6000
    commissionDeducted: 625, // 5% of 12500
    expensesDeducted: 400, // maintenance fees
    netAmountPaid: 11475,
    payoutDate: '2026-06-30',
    paymentMethod: 'حوالة بنكية صادرة',
    bankTransactionRef: 'TXN-9847293-CIB',
    createdBy: 'الأستاذ عربي رميح',
    notes: 'تسوية شهر يونيو بالكامل لبرج الرميح، تم التحويل وإرسال كشف الحساب بصيغة PDF.',
    status: 'payout_completed',
    signedByOwner: true,
    signatureDate: '2026-07-02',
    createdAt: '2026-06-30'
  }
];

export const initialExpenses: RePropertyExpense[] = [
  {
    id: 'exp-1',
    propertyId: 'prop-1',
    ownerId: 'owner-1',
    amount: 400,
    category: 'نظافة وصيانة عامة',
    description: 'صيانة كشافات السلم وتنظيف المداخل بالبرج السكني.',
    expenseDate: '2026-06-15',
    recordedBy: 'مكتب المحاماة',
    createdAt: '2026-06-15'
  },
  {
    id: 'exp-2',
    propertyId: 'prop-2',
    ownerId: 'owner-2',
    amount: 1200,
    category: 'إصلاحات سباكة وطوارئ',
    description: 'إصلاح محبس رئيسي للماء في المجمع التجاري لمنع التسريب.',
    expenseDate: '2026-07-10',
    recordedBy: 'مكتب المحاماة',
    createdAt: '2026-07-10'
  }
];

export const initialLogs: ReRealEstateLog[] = [
  {
    id: 'log-1',
    actionType: 'add',
    entityName: 'مالك عقار',
    details: 'تسجيل المالك الجديد "الحاج أحمد عبد الرحمن الرميح" وإدخال حسابه البنكي بالنظام.',
    username: 'عربي رميح',
    timestamp: '2026-01-01 10:30:00'
  },
  {
    id: 'log-2',
    actionType: 'collection',
    entityName: 'عملية تحصيل',
    details: 'تحصيل مبلغ 6500 جنيه إيجار شقة 101 لصالح الحاج أحمد الرميح وإصدار إيصال REC-2026-0001.',
    username: 'المحصل المتنقل',
    timestamp: '2026-06-04 14:15:00'
  }
];

export const initialDues: ReRentDue[] = [
  {
    id: 'due-tenant-1-2026-07',
    tenantId: 'tenant-1',
    tenantName: 'المهندس مصطفى علي محمود',
    tenantPhone: '01098765432',
    unitId: 'unit-101',
    unitNumber: '101',
    propertyId: 'prop-1',
    propertyName: 'برج الرميح السكني (أ)',
    ownerId: 'owner-1',
    ownerName: 'الحاج أحمد عبد الرحمن الرميح',
    contractNumber: 'CON-2026-1001',
    forMonthYear: '2026-07',
    monthNameAr: 'يوليو 2026',
    dueDate: '2026-07-05',
    rentAmount: 6500,
    commissionType: 'percentage',
    commissionValue: 5,
    commissionAmount: 325,
    netOwnerAmount: 6175,
    status: 'pending',
    createdAt: '2026-07-01'
  },
  {
    id: 'due-tenant-2-2026-07',
    tenantId: 'tenant-2',
    tenantName: 'الدكتور ياسر إبراهيم عبد الله',
    tenantPhone: '01112233445',
    unitId: 'unit-102',
    unitNumber: '102',
    propertyId: 'prop-1',
    propertyName: 'برج الرميح السكني (أ)',
    ownerId: 'owner-1',
    ownerName: 'الحاج أحمد عبد الرحمن الرميح',
    contractNumber: 'CON-2026-1002',
    forMonthYear: '2026-07',
    monthNameAr: 'يوليو 2026',
    dueDate: '2026-07-05',
    rentAmount: 6000,
    commissionType: 'percentage',
    commissionValue: 5,
    commissionAmount: 300,
    netOwnerAmount: 5700,
    status: 'pending',
    createdAt: '2026-07-01'
  },
  {
    id: 'due-tenant-3-2026-07',
    tenantId: 'tenant-3',
    tenantName: 'شركة النيل للتجارة والتوزيع',
    tenantPhone: '01200001122',
    unitId: 'unit-c1',
    unitNumber: 'محل 1 أرضي',
    propertyId: 'prop-2',
    propertyName: 'مجمع الشناوي التجاري والإداري',
    ownerId: 'owner-2',
    ownerName: 'الأستاذ كمال محمد الشناوي',
    contractNumber: 'CON-2026-2001',
    forMonthYear: '2026-07',
    monthNameAr: 'يوليو 2026',
    dueDate: '2026-07-01',
    rentAmount: 25000,
    commissionType: 'fixed_per_thousand',
    commissionValue: 50,
    commissionAmount: 1250,
    netOwnerAmount: 23750,
    status: 'pending',
    createdAt: '2026-07-01'
  }
];
