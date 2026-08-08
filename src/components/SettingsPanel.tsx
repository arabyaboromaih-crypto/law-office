import React, { useState, useEffect } from 'react';
import { 
  Settings, Building2, Database, Download, Upload, RefreshCw, Check, AlertTriangle, FileText, MessageSquare, MapPin, Phone, Mail, ShieldCheck, Code, Terminal, Cpu, Users, Palette
} from 'lucide-react';
import { User, Case, Client, Company, HearingSession, AuditLog, LegalTask } from '../types';

interface SettingsPanelProps {
  currentUser: User | null;
  onAddAuditLog: (user: User | null, action: string, details: string) => void;
  // Callback to force parent App state reload after import
  onDataReloadNeeded: () => void;
  users: User[];
  onUpdateUser: (user: User) => Promise<void>;
  officeSettings?: any;
  onUpdateSettings?: (settings: any) => Promise<void>;
}

export default function SettingsPanel({ 
  currentUser, 
  onAddAuditLog, 
  onDataReloadNeeded, 
  users, 
  onUpdateUser,
  officeSettings,
  onUpdateSettings
}: SettingsPanelProps) {
  // Security Unlock Password States
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('romeih_settings_unlocked') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // General Director states
  const [generalDirectorName, setGeneralDirectorName] = useState('الأستاذ عربي رميح');
  const [generalDirectorTitle, setGeneralDirectorTitle] = useState('المدير العام ومدير المؤسسة');
  const [generalDirectorPhone, setGeneralDirectorPhone] = useState('01012345678');
  const [generalDirectorEmail, setGeneralDirectorEmail] = useState('araby@romeih-law.com');
  const [selectedDirectorId, setSelectedDirectorId] = useState<string>('');

  // Local states for settings fields
  const [officeName, setOfficeName] = useState('مؤسسة رميح للمحاماة والاستشارات القانونية');
  const [officeSubtitle, setOfficeSubtitle] = useState('نظام إدارة القضايا والشركات المتكامل - متوافق كلياً مع نظام المحاكم المصرية الحديث');
  const [officeAddress, setOfficeAddress] = useState('٤٥ شارع المحكمة الدستورية العليا، المعادي، القاهرة');
  const [officeWhatsapp, setOfficeWhatsapp] = useState('+20120000000');
  const [officeEmail, setOfficeEmail] = useState('contact@romeih-law.com');
  const [numberingSystem, setNumberingSystem] = useState('arabic');
  
  // Custom templates
  const [tplSession, setTplSession] = useState(
    'السلام عليكم ورحمة الله وبركاته، نحيط سيادتكم علماً بأن لديكم جلسة قضائية قادمة يوم {date} في تمام الساعة {time} أمام محكمة {court} (دائرة {circuit}). نرجو الاستعداد المالي والفني اللازم. شاكرين لثقتكم بمؤسسة رميح للمحاماة.'
  );
  const [tplTask, setTplTask] = useState(
    'عزيزي الأستاذ {lawyer}، تم إسناد المهمة التالية لسيادتكم: [{taskNumber}] - "{title}". تاريخ التنفيذ المطلوب: {executionDate}. يرجى المتابعة وتسجيل الإجراء على البوابة فور الإتمام.'
  );

  const [isSaved, setIsSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);



  // Load settings on mount or when officeSettings prop changes
  useEffect(() => {
    if (officeSettings) {
      if (officeSettings.officeName) setOfficeName(officeSettings.officeName);
      if (officeSettings.officeSubtitle) setOfficeSubtitle(officeSettings.officeSubtitle);
      if (officeSettings.officeAddress) setOfficeAddress(officeSettings.officeAddress);
      if (officeSettings.officeWhatsapp) setOfficeWhatsapp(officeSettings.officeWhatsapp);
      if (officeSettings.officeEmail) setOfficeEmail(officeSettings.officeEmail);
      if (officeSettings.numberingSystem) setNumberingSystem(officeSettings.numberingSystem);
      if (officeSettings.tplSession) setTplSession(officeSettings.tplSession);
      if (officeSettings.tplTask) setTplTask(officeSettings.tplTask);
      
      if (officeSettings.generalDirectorName) setGeneralDirectorName(officeSettings.generalDirectorName);
      if (officeSettings.generalDirectorTitle) setGeneralDirectorTitle(officeSettings.generalDirectorTitle);
      if (officeSettings.generalDirectorPhone) setGeneralDirectorPhone(officeSettings.generalDirectorPhone);
      if (officeSettings.generalDirectorEmail) setGeneralDirectorEmail(officeSettings.generalDirectorEmail);
    } else {
      const savedName = localStorage.getItem('romeih_office_name');
      const savedSubtitle = localStorage.getItem('romeih_office_subtitle');
      const savedAddress = localStorage.getItem('romeih_office_address');
      const savedWhatsapp = localStorage.getItem('romeih_office_whatsapp');
      const savedEmail = localStorage.getItem('romeih_office_email');
      const savedNumbering = localStorage.getItem('romeih_numbering_system');
      
      const savedTplSession = localStorage.getItem('romeih_tpl_session');
      const savedTplTask = localStorage.getItem('romeih_tpl_task');

      if (savedName) setOfficeName(savedName);
      if (savedSubtitle) setOfficeSubtitle(savedSubtitle);
      if (savedAddress) setOfficeAddress(savedAddress);
      if (savedWhatsapp) setOfficeWhatsapp(savedWhatsapp);
      if (savedEmail) setOfficeEmail(savedEmail);
      if (savedNumbering) setNumberingSystem(savedNumbering);
      if (savedTplSession) setTplSession(savedTplSession);
      if (savedTplTask) setTplTask(savedTplTask);

      // General Director Details
      const savedDirectorName = localStorage.getItem('romeih_general_director_name') || 'الأستاذ عربي رميح';
      const savedDirectorTitle = localStorage.getItem('romeih_general_director_title') || 'المدير العام ومدير المؤسسة';
      const savedDirectorPhone = localStorage.getItem('romeih_general_director_phone') || '01012345678';
      const savedDirectorEmail = localStorage.getItem('romeih_general_director_email') || 'araby@romeih-law.com';

      setGeneralDirectorName(savedDirectorName);
      setGeneralDirectorTitle(savedDirectorTitle);
      setGeneralDirectorPhone(savedDirectorPhone);
      setGeneralDirectorEmail(savedDirectorEmail);
    }

    // Get current admin user from loaded master users list
    const currentAdmin = users.find((u: any) => u.role === 'admin');
    if (currentAdmin) {
      setSelectedDirectorId(currentAdmin.id);
    }
  }, [users, officeSettings]);

  const handleAssignDirectorFromUsers = async (userId: string) => {
    if (!userId) return;
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        // Promote to admin/General Director
        return {
          ...u,
          role: 'admin' as const,
          title: 'المدير العام ومدير المؤسسة'
        };
      } else if (u.role === 'admin') {
        // Demote previous admin to lawyer
        return {
          ...u,
          role: 'lawyer' as const,
          title: 'محامٍ بالمؤسسة'
        };
      }
      return u;
    });

    const newDirector = updatedUsers.find(u => u.id === userId);
    if (newDirector) {
      setGeneralDirectorName(newDirector.fullName);
      setGeneralDirectorTitle(newDirector.title || 'المدير العام ومدير المؤسسة');
      setGeneralDirectorPhone(newDirector.phone);
      setGeneralDirectorEmail(newDirector.email);
      
      localStorage.setItem('romeih_general_director_name', newDirector.fullName);
      localStorage.setItem('romeih_general_director_title', newDirector.title || 'المدير العام ومدير المؤسسة');
      localStorage.setItem('romeih_general_director_phone', newDirector.phone);
      localStorage.setItem('romeih_general_director_email', newDirector.email);
      localStorage.setItem('romeih_general_director_assigned', 'true');

      if (onUpdateSettings) {
        onUpdateSettings({
          id: 'office_settings',
          officeName,
          officeSubtitle,
          officeAddress,
          officeWhatsapp,
          officeEmail,
          numberingSystem,
          tplSession,
          tplTask,
          generalDirectorName: newDirector.fullName,
          generalDirectorTitle: newDirector.title || 'المدير العام ومدير المؤسسة',
          generalDirectorPhone: newDirector.phone,
          generalDirectorEmail: newDirector.email,
          isSystemUnlocked: true,
          isDirectorAssigned: true
        }).catch(err => console.error("Failed to update settings in Firestore:", err));
      }
    }

    // Now update those modified users back to Firestore!
    for (const u of updatedUsers) {
      const orig = users.find(o => o.id === u.id);
      if (orig && (orig.role !== u.role || orig.title !== u.title)) {
        await onUpdateUser(u);
      }
    }

    setSelectedDirectorId(userId);
    
    onAddAuditLog(currentUser, 'edit', `تعيين الأستاذ ${newDirector?.fullName || ''} مديراً عاماً ومسؤولاً أول للمؤسسة`);
    
    alert(`تم تعيين الأستاذ ${newDirector?.fullName || ''} كمدير عام للمؤسسة وتحديث الصلاحيات بنجاح!`);
    onDataReloadNeeded();
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    
    localStorage.setItem('romeih_office_name', officeName);
    localStorage.setItem('romeih_office_subtitle', officeSubtitle);
    localStorage.setItem('romeih_office_address', officeAddress);
    localStorage.setItem('romeih_office_whatsapp', officeWhatsapp);
    localStorage.setItem('romeih_office_email', officeEmail);
    localStorage.setItem('romeih_numbering_system', numberingSystem);
    
    localStorage.setItem('romeih_tpl_session', tplSession);
    localStorage.setItem('romeih_tpl_task', tplTask);

    if (onUpdateSettings) {
      onUpdateSettings({
        id: 'office_settings',
        officeName,
        officeSubtitle,
        officeAddress,
        officeWhatsapp,
        officeEmail,
        numberingSystem,
        tplSession,
        tplTask,
        generalDirectorName,
        generalDirectorTitle,
        generalDirectorPhone,
        generalDirectorEmail,
        isSystemUnlocked: true,
        isDirectorAssigned: true
      }).catch(err => console.error("Failed to update settings in Firestore:", err));
    }

    setIsSaved(true);
    onAddAuditLog(currentUser, 'edit', 'تحديث إعدادات النظام وقوالب الرسائل الافتراضية');
    
    // Broadcast setting changes so other components immediately see updated values
    window.dispatchEvent(new Event('storage'));

    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  // EXPORT Backup JSON
  const handleExportBackup = () => {
    try {
      const backupData: Record<string, any> = {};
      
      // Collect all keys from localStorage
      const keysToBackup = [
        'romeih_users',
        'romeih_clients',
        'romeih_companies',
        'romeih_cases',
        'romeih_sessions',
        'romeih_audit_logs',
        'romeih_tasks',
        'romeih_office_name',
        'romeih_office_subtitle',
        'romeih_office_address',
        'romeih_office_whatsapp',
        'romeih_office_email',
        'romeih_tpl_session',
        'romeih_tpl_task'
      ];

      keysToBackup.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            backupData[key] = JSON.parse(val);
          } catch {
            backupData[key] = val; // fallback for raw string keys
          }
        }
      });

      // Wrap in structured container with metadata
      const finalBackup = {
        appId: 'romeih_judicial_portal',
        exportDate: new Date().toISOString(),
        exportedBy: currentUser?.fullName || 'مستخدم مجهول',
        data: backupData
      };

      const blob = new Blob([JSON.stringify(finalBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Romeih_Portal_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onAddAuditLog(currentUser, 'add', 'تصدير نسخة احتياطية كاملة لقاعدة بيانات النظام وملفاته');
    } catch (err: any) {
      alert(`عذراً، حدث خطأ أثناء تصدير البيانات: ${err.message}`);
    }
  };

  // IMPORT Backup JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(false);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Basic schema check
        if (!parsed || parsed.appId !== 'romeih_judicial_portal' || !parsed.data) {
          throw new Error('ملف النسخ الاحتياطي غير صالح أو لا يخص البوابة القضائية لمؤسسة رميح.');
        }

        const dataObj = parsed.data;
        
        // Confirm before action
        const confirmMsg = `⚠️ تنبيه هام!\nسيتم استيراد نسخة احتياطية تم تصديرها بتاريخ: ${new Date(parsed.exportDate).toLocaleString('ar-EG')}\nبواسطة الأستاذ: ${parsed.exportedBy}\n\n*ملاحظة خطيرة:* سيؤدي هذا الإجراء إلى استبدال كافة البيانات الحالية بالكامل في متصفحك. هل أنت متأكد من الاستمرار؟`;
        
        if (!window.confirm(confirmMsg)) {
          e.target.value = ''; // Reset input
          return;
        }

        // Apply back to localStorage
        Object.keys(dataObj).forEach(key => {
          const val = dataObj[key];
          if (typeof val === 'string') {
            localStorage.setItem(key, val);
          } else {
            localStorage.setItem(key, JSON.stringify(val));
          }
        });

        setImportSuccess(true);
        onAddAuditLog(currentUser, 'restore', `استيراد واستعادة نسخة احتياطية كاملة بنجاح صادرة من: ${parsed.exportedBy}`);
        
        // Let parent know to sync React state immediately
        setTimeout(() => {
          onDataReloadNeeded();
        }, 1500);

      } catch (err: any) {
        setImportError(err.message || 'فشل قراءة الملف أو معالجة محتوياته كصيغة JSON صالحة.');
      }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  // HARD RESET
  const handleHardReset = () => {
    const confirmation = window.confirm(
      '🚨 تحذير أمني وقانوني شديد الخطورة!\n\nأنت على وشك حذف كافة البيانات الحالية المسجلة على هذا النظام (قضايا، موكلين، شركات، مهام، مالي، مستخدمين) وإعادتها لوضع المصنع التلقائي الافتراضي.\n\nهذا الإجراء غير قابل للتراجع نهائياً!\nهل تود تأكيد تصفير النظام التام؟'
    );
    
    if (confirmation) {
      const doubleCheck = window.prompt('لتأكيد الحذف النهائي، اكتب الكلمة التالية في المربع المخصص: "حذف نهائي"');
      if (doubleCheck === 'حذف نهائي') {
        localStorage.clear();
        onAddAuditLog(currentUser, 'delete', 'إجراء تصفير أمني كامل وإعادة ضبط النظام لإعدادات المصنع المبدئية');
        alert('تم تصفير النظام بالكامل بنجاح. سيتم الآن تحديث الصفحة لتحميل البيانات التأسيسية.');
        window.location.reload();
      } else {
        alert('تم إلغاء عملية تصفير النظام لعدم مطابقة عبارة التأكيد.');
      }
    }
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-slate-200 rounded-2xl p-8 shadow-md text-center space-y-6 animate-fadeIn" dir="rtl">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-extrabold text-slate-900">بوابة التهيئة والتحكم الإداري الأعلى</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            هذا القسم مخصص للعمليات الحساسة وإعدادات النظام وتعيين المدير العام وسحب وتصدير النسخ الاحتياطية للمؤسسة.
          </p>
          <p className="text-xs font-bold text-amber-600">
            يتطلب الدخول إدخال كلمة السر الخاصة بالإدارة العليا.
          </p>
        </div>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          if (passwordInput === '199311') {
            setIsUnlocked(true);
            localStorage.setItem('romeih_settings_unlocked', 'true');
            onAddAuditLog(currentUser, 'login', 'الولوج المصرح للوحة إعدادات التهيئة العامة بكلمة سر الإدارة العليا');
          } else {
            setPasswordError('كلمة السر غير صحيحة! يرجى التأكد وإعادة المحاولة.');
          }
        }} className="space-y-4">
          <div className="space-y-1 text-right">
            <label className="text-[11px] font-bold text-slate-500 block mr-1">كلمة سر الإدارة العامة *</label>
            <input
              type="password"
              required
              placeholder="••••••"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError('');
              }}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2.5 px-4 text-center font-mono font-bold text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 placeholder-slate-300"
            />
          </div>

          {passwordError && (
            <p className="text-xs text-red-600 font-bold bg-red-50 py-2 px-3 rounded-lg border border-red-200 animate-shake">
              {passwordError}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            تأكيد الهوية وفتح الصلاحيات
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 animate-fadeIn" dir="rtl">
      
      {/* Dynamic Header */}
      <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Settings className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">إعدادات النظام والتهيئة العامة</h2>
              <p className="text-xs text-slate-500 mt-1">تخصيص هوية المؤسسة القانونية، قوالب مراسلات الواتساب، والنسخ الاحتياطي لقاعدة البيانات</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            لوحة المدير العام
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Right side form: Office Information */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4 px-6 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-500" />
                بيانات الهوية القانونية للمكتب والمؤسسة
              </span>
              
              {isSaved && (
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  تم حفظ التغييرات بنجاح!
                </span>
              )}
            </div>

            <div className="p-6 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">اسم مكتب المحاماة / المؤسسة</label>
                  <div className="relative">
                    <span className="absolute right-3 top-2.5 text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={officeName}
                      onChange={(e) => setOfficeName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 pr-9 pl-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">العنوان الجغرافي للمقر الرئيسي</label>
                  <div className="relative">
                    <span className="absolute right-3 top-2.5 text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 pr-9 pl-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">شعار المكتب / النص الوصفي المساعد</label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-400">
                    <FileText className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={officeSubtitle}
                    onChange={(e) => setOfficeSubtitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 pr-9 pl-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">هاتف واتساب الافتراضي للمكتب</label>
                  <div className="relative" dir="ltr">
                    <span className="absolute left-3 top-2.5 text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={officeWhatsapp}
                      onChange={(e) => setOfficeWhatsapp(e.target.value)}
                      placeholder="+201000000000"
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 pl-9 pr-3 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">البريد الإلكتروني الرسمي للمكتب</label>
                  <div className="relative" dir="ltr">
                    <span className="absolute left-3 top-2.5 text-slate-400">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={officeEmail}
                      onChange={(e) => setOfficeEmail(e.target.value)}
                      placeholder="info@yourdomain.com"
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2 pl-9 pr-3 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block text-right">لغة كتابة الأرقام بالتطبيق</label>
                  <select
                    value={numberingSystem}
                    onChange={(e) => setNumberingSystem(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                  >
                    <option value="arabic">الأرقام العربية (٠١٢٣٤٥٦٧٨٩)</option>
                    <option value="english">الأرقام الإنجليزية (0123456789)</option>
                  </select>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Template Configurations */}
              <div className="space-y-4">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  قوالب إرسال رسائل WhatsApp التلقائية
                </span>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-500 block">قالب تذكير الموكل بجلسته القادمة</label>
                      <span className="text-[9px] text-slate-400 font-bold font-mono">المتغيرات المقبولة: {"{date}, {time}, {court}, {circuit}"}</span>
                    </div>
                    <textarea
                      rows={3}
                      value={tplSession}
                      onChange={(e) => setTplSession(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-500 block">قالب إخطار المحامي بتكليفه بمهمة عمل</label>
                      <span className="text-[9px] text-slate-400 font-bold font-mono">المتغيرات المقبولة: {"{lawyer}, {taskNumber}, {title}, {executionDate}"}</span>
                    </div>
                    <textarea
                      rows={3}
                      value={tplTask}
                      onChange={(e) => setTplTask(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end px-6">
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-6 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                حفظ بيانات وهوية المؤسسة
              </button>
            </div>
          </form>

          {/* Card: General Director Settings */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4 px-6 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                تعيين وتفويض المدير العام والمسؤول الأول للمؤسسة
              </span>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-500 leading-relaxed">
                من خلال هذا القسم الحساس والمحمي بكلمة المرور الأمنية، يمكنك تعيين أو تفويض محامٍ مسجل في النظام ليتولى رتبة وصلاحيات <strong>المدير العام للمؤسسة</strong>، أو تعديل البيانات التعريفية المعروضة للمدير العام الحالي.
              </p>

              {/* 1. Quick Assign From Users list if available */}
              {users.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-200/60 p-4 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-amber-800 block">تفويض وتعيين سريع من قائمة المستخدمين النشطين:</span>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedDirectorId}
                      onChange={(e) => setSelectedDirectorId(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="">-- اختر مستخدم لتفويضه كمدير عام --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.title || u.role}) - {u.phone}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAssignDirectorFromUsers(selectedDirectorId)}
                      className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs py-2 px-4 rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      تأكيد التعيين والتفويض
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Manual Fields for General Director Profile details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">اسم المدير العام الافتراضي</label>
                  <input
                    type="text"
                    value={generalDirectorName}
                    onChange={(e) => setGeneralDirectorName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">المسمى الوظيفي للمدير العام</label>
                  <input
                    type="text"
                    value={generalDirectorTitle}
                    onChange={(e) => setGeneralDirectorTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">رقم هاتف المدير العام</label>
                  <input
                    type="text"
                    value={generalDirectorPhone}
                    onChange={(e) => setGeneralDirectorPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">البريد الإلكتروني للمدير العام</label>
                  <input
                    type="email"
                    value={generalDirectorEmail}
                    onChange={(e) => setGeneralDirectorEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end px-6">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('romeih_general_director_name', generalDirectorName);
                  localStorage.setItem('romeih_general_director_title', generalDirectorTitle);
                  localStorage.setItem('romeih_general_director_phone', generalDirectorPhone);
                  localStorage.setItem('romeih_general_director_email', generalDirectorEmail);
                  localStorage.setItem('romeih_general_director_assigned', 'true');
                  
                  if (onUpdateSettings) {
                    onUpdateSettings({
                      id: 'office_settings',
                      officeName,
                      officeSubtitle,
                      officeAddress,
                      officeWhatsapp,
                      officeEmail,
                      numberingSystem,
                      tplSession,
                      tplTask,
                      generalDirectorName,
                      generalDirectorTitle,
                      generalDirectorPhone,
                      generalDirectorEmail,
                      isSystemUnlocked: true,
                      isDirectorAssigned: true
                    }).catch(err => console.error("Failed to update settings in Firestore:", err));
                  }

                  // Also look for director in users to synchronize
                  const updatedUsers = users.map(u => {
                    if (u.role === 'admin' || u.id === selectedDirectorId) {
                      return {
                        ...u,
                        fullName: generalDirectorName,
                        title: generalDirectorTitle,
                        phone: generalDirectorPhone,
                        email: generalDirectorEmail
                      };
                    }
                    return u;
                  });
                  
                  // Now update those modified users back to Firestore!
                  updatedUsers.forEach(u => {
                    const orig = users.find(o => o.id === u.id);
                    if (orig && (orig.fullName !== u.fullName || orig.title !== u.title || orig.phone !== u.phone || orig.email !== u.email)) {
                      onUpdateUser(u).catch(err => console.error("Failed to update director user:", err));
                    }
                  });
                  
                  onAddAuditLog(currentUser, 'edit', 'تحديث بيانات ملف المدير العام للمؤسسة من لوحة التحكم');
                  alert('تم حفظ وتحديث بيانات المدير العام للمؤسسة بنجاح!');
                  onDataReloadNeeded();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-6 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                حفظ وتحديث ملف المدير العام
              </button>
            </div>
          </div>


        </div>

        {/* Left side column: Data backups and hard actions */}
        <div className="space-y-6">
          
          {/* Database management box */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4 px-6">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-500" />
                إدارة قواعد البيانات والنسخ الاحتياطي
              </span>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                البوابة تعتمد بشكل كامل على الحفظ المحلي الآمن وفهرسة متصفحك. لحماية ملفات موكليك وقضاياك من الضياع في حال تبديل جهازك أو تصفير ذاكرة المتصفح، يرجى القيام بتنزيل نسخة احتياطية دورياً.
              </p>

              <div className="h-px bg-slate-100" />

              {/* Action Buttons */}
              <div className="space-y-3">
                
                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-500" />
                  تنزيل ملف النسخة الاحتياطية (JSON)
                </button>

                {/* Import Button with input wrapper */}
                <div className="relative">
                  <label
                    htmlFor="import-file-input"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-200 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    استيراد نسخة احتياطية سابقة
                  </label>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>

                {importSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-700 animate-pulse">
                    ✅ تم الاستيراد بنجاح! جاري مزامنة وتهيئة البيانات الآن...
                  </div>
                )}

                {importError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center text-xs font-bold text-red-700">
                    ❌ خطأ: {importError}
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Hard Danger Zone */}
          <div className="bg-red-50/50 border border-red-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 p-4 px-6 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-xs font-extrabold text-red-800">منطقة العمليات الحساسة (Danger Zone)</span>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[11px] text-red-700/80 leading-relaxed">
                الخيارات التالية لا يمكن التراجع عنها وتتسبب في محو تام لقاعدة البيانات والاتعاب وحسابات المستخدمين المضافة. يرجى الحذر الشديد قبل الإقدام عليها.
              </p>

              <button
                type="button"
                onClick={handleHardReset}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-red-100 animate-spin" />
                تصفير النظام وإعادة ضبط المصنع
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
