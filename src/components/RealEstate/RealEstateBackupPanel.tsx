import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, Download, Upload, RefreshCw, AlertTriangle, 
  CheckCircle, FileText, Building, Users, Wallet, Landmark, 
  Trash2, ShieldCheck, Clock, FileJson, ArrowDownToLine, RotateCcw, Plus, Check
} from 'lucide-react';
import { 
  ReOwner, ReProperty, ReUnit, ReTenant, 
  ReCollectionReceipt, RePayout, RePropertyExpense, 
  ReOwnerAdvance, ReRealEstateLog, ReRentDue, ReCommissionStatus, User 
} from '../../types';
import { restoreRealEstateBackupBatch, RealEstateBackupPayload } from '../../services/dbSync';

interface SavedBackupItem {
  id: string;
  filename: string;
  version: string;
  createdAt: string;
  type: 'manual' | 'auto_before_restore' | 'imported';
  note?: string;
  payload: RealEstateBackupPayload;
  stats: {
    ownersCount: number;
    propertiesCount: number;
    unitsCount: number;
    tenantsCount: number;
    collectionsCount: number;
    payoutsCount: number;
    expensesCount: number;
    advancesCount: number;
    duesCount: number;
    commissionStatusesCount: number;
  };
}

interface RealEstateBackupPanelProps {
  owners: ReOwner[];
  properties: ReProperty[];
  units: ReUnit[];
  tenants: ReTenant[];
  collections: ReCollectionReceipt[];
  payouts: RePayout[];
  expenses: RePropertyExpense[];
  advances: ReOwnerAdvance[];
  dues: ReRentDue[];
  commissionStatuses: ReCommissionStatus[];
  deletedDueIds: string[];
  logs: ReRealEstateLog[];
  currentUser: User;
  onRestoreComplete: (data: RealEstateBackupPayload['data']) => void;
  logAction: (actionType: 'add' | 'edit' | 'delete' | 'collection' | 'payout', entityName: string, details: string) => Promise<void>;
}

export default function RealEstateBackupPanel({
  owners,
  properties,
  units,
  tenants,
  collections,
  payouts,
  expenses,
  advances,
  dues,
  commissionStatuses,
  deletedDueIds,
  logs,
  currentUser,
  onRestoreComplete,
  logAction
}: RealEstateBackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved Backups list state
  const [savedBackups, setSavedBackups] = useState<SavedBackupItem[]>(() => {
    try {
      const saved = localStorage.getItem('re_saved_backups_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('re_saved_backups_v1', JSON.stringify(savedBackups));
    } catch (e) {
      console.error('Failed to save backups history to localStorage', e);
    }
  }, [savedBackups]);

  // Alert & Feedback state
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Restore Modal State
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false);
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<SavedBackupItem | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Helper: Format Date & Time for standard file names
  const formatDateTimeForFilename = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  };

  // Helper: Create current snapshot backup item
  const buildCurrentSnapshotPayload = (type: 'manual' | 'auto_before_restore' | 'imported' = 'manual', note?: string): SavedBackupItem => {
    const dtStr = formatDateTimeForFilename();
    const filename = type === 'auto_before_restore'
      ? `real_estate_AUTO_BACKUP_${dtStr}_v1.0.json`
      : `real_estate_backup_${dtStr}_v1.0.json`;

    const payload: RealEstateBackupPayload = {
      appName: 'مؤسسة رميح للمحاماة والاستشارات القانونية',
      module: 'real_estate_management',
      version: '1.0',
      createdAt: new Date().toISOString(),
      filename,
      data: {
        owners: [...owners],
        properties: [...properties],
        units: [...units],
        tenants: [...tenants],
        collections: [...collections],
        payouts: [...payouts],
        expenses: [...expenses],
        advances: [...advances],
        dues: [...dues],
        commissionStatuses: [...commissionStatuses],
        deletedDues: deletedDueIds.map(id => ({ id })),
        logs: [...logs]
      }
    };

    return {
      id: `backup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      filename,
      version: '1.0',
      createdAt: new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }),
      type,
      note,
      payload,
      stats: {
        ownersCount: owners.length,
        propertiesCount: properties.length,
        unitsCount: units.length,
        tenantsCount: tenants.length,
        collectionsCount: collections.length,
        payoutsCount: payouts.length,
        expensesCount: expenses.length,
        advancesCount: advances.length,
        duesCount: dues.length,
        commissionStatusesCount: commissionStatuses.length
      }
    };
  };

  // Action 1: Create Backup
  const handleCreateBackup = () => {
    const backupItem = buildCurrentSnapshotPayload('manual', 'نسخة احتياطية يدوية أنشئت بواسطة المستخدم');
    setSavedBackups(prev => [backupItem, ...prev]);
    setStatusMsg({
      type: 'success',
      text: `✅ تم إنشاء النسخة الاحتياطية بنجاح باسم: (${backupItem.filename})`
    });
  };

  // Action 2: Download Backup as JSON file
  const handleDownloadBackup = (backupItem: SavedBackupItem) => {
    try {
      const jsonStr = JSON.stringify(backupItem.payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupItem.filename || `real_estate_backup_${Date.now()}_v1.0.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: 'success',
        text: `📥 تم تنزيل ملف النسخة الاحتياطية (${backupItem.filename}) إلى جهازك.`
      });
    } catch (err: any) {
      alert(`❌ فشل تنزيل الملف: ${err.message || ''}`);
    }
  };

  // Action 3: Import Backup File
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content) as RealEstateBackupPayload;

        if (!parsed || (!parsed.data && !(parsed as any).owners)) {
          throw new Error('الملف المحدد لا يحتوي على بنية بيانات صالحة للإدارة العقارية.');
        }

        const dataObj = parsed.data || (parsed as any);

        const importedItem: SavedBackupItem = {
          id: `backup_imported_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          filename: file.name,
          version: parsed.version || '1.0',
          createdAt: parsed.createdAt ? new Date(parsed.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString('ar-EG'),
          type: 'imported',
          note: `نسخة مستوردة من الملف المحلي (${file.name})`,
          payload: {
            appName: parsed.appName || 'مؤسسة رميح للمحاماة',
            module: 'real_estate_management',
            version: parsed.version || '1.0',
            createdAt: parsed.createdAt || new Date().toISOString(),
            filename: file.name,
            data: {
              owners: dataObj.owners || [],
              properties: dataObj.properties || [],
              units: dataObj.units || [],
              tenants: dataObj.tenants || [],
              collections: dataObj.collections || [],
              payouts: dataObj.payouts || [],
              expenses: dataObj.expenses || [],
              advances: dataObj.advances || [],
              dues: dataObj.dues || [],
              commissionStatuses: dataObj.commissionStatuses || [],
              deletedDues: dataObj.deletedDues || [],
              logs: dataObj.logs || []
            }
          },
          stats: {
            ownersCount: dataObj.owners?.length || 0,
            propertiesCount: dataObj.properties?.length || 0,
            unitsCount: dataObj.units?.length || 0,
            tenantsCount: dataObj.tenants?.length || 0,
            collectionsCount: dataObj.collections?.length || 0,
            payoutsCount: dataObj.payouts?.length || 0,
            expensesCount: dataObj.expenses?.length || 0,
            advancesCount: dataObj.advances?.length || 0,
            duesCount: dataObj.dues?.length || 0,
            commissionStatusesCount: dataObj.commissionStatuses?.length || 0
          }
        };

        setSavedBackups(prev => [importedItem, ...prev]);
        setStatusMsg({
          type: 'success',
          text: `📂 تم استيراد ملف النسخة الاحتياطية (${file.name}) بنجاح وإضافته لسجل النسخ المحفوظة.`
        });
      } catch (err: any) {
        alert(`❌ فشل قراءة واستيراد الملف: ${err.message || 'تنسيق غير مدعوم'}`);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Action 4: Initiate Restore directly without creating an auto-backup
  const handleInitiateRestore = (backupItem: SavedBackupItem) => {
    setSelectedBackupToRestore(backupItem);
    setShowRestoreConfirmModal(true);
  };

  // Execute Restore in Transaction / WriteBatch Chunks
  const handleExecuteRestore = async () => {
    if (!selectedBackupToRestore) return;

    try {
      setIsRestoring(true);

      const targetData = selectedBackupToRestore.payload.data;

      // Requirement #7: Execute inside Firestore Atomic WriteBatch
      await restoreRealEstateBackupBatch(targetData);

      // Requirement #8: Trigger immediate UI update for all Real Estate screens
      onRestoreComplete(targetData);

      await logAction(
        'add',
        'النسخ الاحتياطي للإدارة العقارية',
        `تمت استعادة كافة بيانات الإدارة العقارية بنجاح من النسخة (${selectedBackupToRestore.filename})`
      );

      setStatusMsg({
        type: 'success',
        text: `🎉 تمت استعادة كافة بيانات الإدارة العقارية بنجاح وتحديث جميع الشاشات تلقائياً!`
      });

      setShowRestoreConfirmModal(false);
      setSelectedBackupToRestore(null);
    } catch (err: any) {
      console.error('Error in execute restore:', err);
      alert(`❌ حدث خطأ أثناء تنفيذ الاستعادة: ${err.message || 'تعذر استكمال استرجاع البيانات'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Delete backup from local history list
  const handleDeleteBackupFromHistory = (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف النسخة الاحتياطية (${name}) من السجل؟`)) {
      setSavedBackups(prev => prev.filter(b => b.id !== id));
      setStatusMsg({
        type: 'info',
        text: `تم حذف النسخة (${name}) من القائمة المحفوظة.`
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-[#132238] via-[#0B1524] to-[#132238] border border-[#D4A84F]/25 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute left-0 top-0 w-64 h-64 bg-[#D4A84F]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#D4A84F]/15 border border-[#D4A84F]/30 rounded-2xl text-[#D4A84F]">
                <Database className="w-7 h-7 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-[#F8F9FB]">
                  النسخ الاحتياطي للإدارة العقارية
                </h1>
                <p className="text-xs text-[#9EA7B8] font-bold mt-0.5">
                  نظام إدارة واستعادة نسخ البيانات الخاصة بقسم الإدارة العقارية فقط بشكل مستقِل وآمن.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Create Backup */}
            <button
              onClick={handleCreateBackup}
              className="px-4 py-3 bg-gradient-to-r from-[#D4A84F] to-[#B38734] hover:from-[#E5B95F] hover:to-[#C49845] text-slate-950 text-xs font-black rounded-2xl flex items-center gap-2 shadow-xl shadow-[#D4A84F]/10 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إنشاء نسخة احتياطية</span>
            </button>

            {/* Import Backup File */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-3 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-black rounded-2xl flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 stroke-[2.2]" />
              <span>استيراد نسخة</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Live Data Summary Badges */}
        <div className="mt-6 pt-5 border-t border-[#D4A84F]/15 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="bg-[#08111F]/70 border border-[#D4A84F]/10 rounded-2xl p-3 text-center">
            <span className="text-[10px] text-[#9EA7B8] font-black block">العقارات والمباني</span>
            <span className="text-base font-extrabold text-[#D4A84F] font-mono">{properties.length}</span>
          </div>

          <div className="bg-[#08111F]/70 border border-[#D4A84F]/10 rounded-2xl p-3 text-center">
            <span className="text-[10px] text-[#9EA7B8] font-black block">الوحدات العقارية</span>
            <span className="text-base font-extrabold text-[#D4A84F] font-mono">{units.length}</span>
          </div>

          <div className="bg-[#08111F]/70 border border-[#D4A84F]/10 rounded-2xl p-3 text-center">
            <span className="text-[10px] text-[#9EA7B8] font-black block">الملاك</span>
            <span className="text-base font-extrabold text-[#D4A84F] font-mono">{owners.length}</span>
          </div>

          <div className="bg-[#08111F]/70 border border-[#D4A84F]/10 rounded-2xl p-3 text-center">
            <span className="text-[10px] text-[#9EA7B8] font-black block">العقود والمستأجرين</span>
            <span className="text-base font-extrabold text-[#D4A84F] font-mono">{tenants.length}</span>
          </div>

          <div className="bg-[#08111F]/70 border border-[#D4A84F]/10 rounded-2xl p-3 text-center">
            <span className="text-[10px] text-[#9EA7B8] font-black block">إيصالات التحصيل</span>
            <span className="text-base font-extrabold text-[#D4A84F] font-mono">{collections.length}</span>
          </div>

          <div className="bg-[#08111F]/70 border border-[#D4A84F]/10 rounded-2xl p-3 text-center">
            <span className="text-[10px] text-[#9EA7B8] font-black block">المستحقات والعمولات</span>
            <span className="text-base font-extrabold text-[#D4A84F] font-mono">{dues.length}</span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-black shadow-lg ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : statusMsg.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
        }`}>
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="p-1 hover:opacity-75 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Scope Disclaimer Info Card */}
      <div className="bg-[#132238]/50 border border-[#D4A84F]/15 rounded-3xl p-4 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-[#D4A84F] shrink-0 mt-0.5" />
        <div className="text-xs text-[#9EA7B8] space-y-1 font-bold">
          <p className="text-[#F8F9FB] font-black">ضمان العزل الكامل للأقسام:</p>
          <p>
            تقتصر النسخة الاحتياطية والاستعادة هنا حَصرياً على جميع بيانات قسم الإدارة العقارية (العقود، الوحدات، الملاك، المستأجرون، الإيجارات والتحصيل، كشوف حسابات المستأجرين والملاك، العمولات والمستحقات).
            <span className="text-[#D4A84F] font-black mr-1">لا يتم المساس بأي أقسام أخرى خارِج الإدارة العقارية (مثل القضايا والعملاء العامين والجلسات).</span>
          </p>
        </div>
      </div>

      {/* Saved Backups Table Section */}
      <div className="bg-[#132238]/60 border border-[#D4A84F]/15 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#D4A84F]/15 pb-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-[#D4A84F]" />
            <h2 className="text-sm font-black text-[#F8F9FB]">
              سجل النسخ الاحتياطية المحفوظة والمستوردة ({savedBackups.length})
            </h2>
          </div>
          {savedBackups.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('هل أنت متأكد من تفريغ كامل سجل النسخ الاحتياطية المحفوظة محلياً؟')) {
                  setSavedBackups([]);
                }
              }}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> مسح السجل
            </button>
          )}
        </div>

        {savedBackups.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-[#08111F]/40 border border-[#D4A84F]/10 rounded-2xl p-6">
            <FileJson className="w-12 h-12 text-[#D4A84F]/30 mx-auto" />
            <p className="text-xs font-black text-[#9EA7B8]">
              لا توجد نسخ احتياطية محفوظة حالياً في السجل.
            </p>
            <p className="text-[11px] text-[#9EA7B8]/70">
              اضغط على زر <span className="text-[#D4A84F] font-bold">"إنشاء نسخة احتياطية"</span> لإتاحة نسخة فورية، أو قم باستيراد ملف <span className="text-sky-400 font-bold">.json</span> مخزن على جهازك.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedBackups.map((item) => (
              <div 
                key={item.id}
                className="bg-[#08111F]/80 border border-[#D4A84F]/15 hover:border-[#D4A84F]/35 rounded-2xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-[#D4A84F]">
                      {item.filename}
                    </span>
                    
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      item.type === 'manual' 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : item.type === 'auto_before_restore'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    }`}>
                      {item.type === 'manual' && 'يدوية'}
                      {item.type === 'auto_before_restore' && 'تلقائية قبل الاستعادة'}
                      {item.type === 'imported' && 'مستوردة'}
                    </span>

                    <span className="text-[10px] text-[#9EA7B8] font-bold font-mono">
                      الإصدار: v{item.version}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9EA7B8] font-bold">
                    تاريخ الإنشاء: <span className="text-[#F8F9FB] font-mono">{item.createdAt}</span>
                    {item.note && <span className="text-slate-400 block mt-0.5 font-sans">{item.note}</span>}
                  </p>

                  {/* Micro stats pill */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold text-[#9EA7B8]">
                    <span>📜 العقود: <strong className="text-[#D4A84F] font-mono">{item.stats.tenantsCount}</strong></span>
                    <span>🏢 العقارات: <strong className="text-[#D4A84F] font-mono">{item.stats.propertiesCount}</strong></span>
                    <span>🏠 الوحدات: <strong className="text-[#D4A84F] font-mono">{item.stats.unitsCount}</strong></span>
                    <span>👥 الملاك: <strong className="text-[#D4A84F] font-mono">{item.stats.ownersCount}</strong></span>
                    <span>🧾 التحصيلات: <strong className="text-[#D4A84F] font-mono">{item.stats.collectionsCount}</strong></span>
                  </div>
                </div>

                {/* Item Controls */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#D4A84F]/10">
                  {/* Download */}
                  <button
                    onClick={() => handleDownloadBackup(item)}
                    className="px-3 py-2 bg-[#132238] hover:bg-[#1C3252] border border-[#D4A84F]/25 text-[#D4A84F] text-xs font-black rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="تنزيل الملف"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل النسخة</span>
                  </button>

                  {/* Restore */}
                  <button
                    onClick={() => handleInitiateRestore(item)}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    title="استعادة هذه النسخة"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>استعادة نسخة احتياطية</span>
                  </button>

                  {/* Delete from history */}
                  <button
                    onClick={() => handleDeleteBackupFromHistory(item.id, item.filename)}
                    className="px-3 py-2 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 text-xs font-black rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                    title="حذف النسخة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف النسخة</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RESTORE CONFIRMATION MODAL WITH AUTOMATIC PRE-RESTORE BACKUP WARNING */}
      {showRestoreConfirmModal && selectedBackupToRestore && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0B1524] border-2 border-red-500/50 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center gap-3 text-red-400 border-b border-red-500/20 pb-4">
              <div className="p-3 bg-red-500/15 rounded-2xl border border-red-500/30">
                <AlertTriangle className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#F8F9FB]">
                  تأكيد استعادة بيانات الإدارة العقارية
                </h3>
                <p className="text-[11px] text-red-300 font-bold">
                  إجراء حساس ويتطلب التأكيد الصريح.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#9EA7B8] font-bold leading-relaxed">
              <p className="text-[#F8F9FB]">
                سيؤدي هذا الإجراء إلى استبدال كافة بيانات العقود، الوحدات، الملاك، المستأجرين، التحصيلات، كشوف الحسابات والعمولات بالبيانات المحفوظة في النسخة المحدد:
              </p>

              <div className="bg-[#132238] border border-[#D4A84F]/20 p-3 rounded-2xl space-y-1 font-mono text-[11px]">
                <p className="text-[#D4A84F] font-black">اسم الملف: {selectedBackupToRestore.filename}</p>
                <p className="text-[#9EA7B8]">تاريخ النسخة: {selectedBackupToRestore.createdAt}</p>
                <p className="text-[#9EA7B8]">عدد العقود المسترجعة: {selectedBackupToRestore.stats.tenantsCount}</p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl space-y-1 text-amber-300 text-[11px]">
                <p className="font-black flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  تنبيه هامة بشأن الاستعادة المباشرة:
                </p>
                <p className="text-[10.5px] text-amber-200/90 leading-relaxed pr-5">
                  سيتم استبدال بيانات الإدارة العقارية الحالية المباشرة فوراً بالبيانات المحفوظة في هذه النسخة فقط، دون إنشاء أي نسخة احتياطية جديدة أو تلقائية أثناء العملية.
                </p>
              </div>

              <p className="text-[#F8F9FB] font-black pt-1">
                ⚠️ هل أنت متأكد من المتابعة واستعادة هذه النسخة الآن؟
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D4A84F]/15">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreConfirmModal(false);
                  setSelectedBackupToRestore(null);
                }}
                disabled={isRestoring}
                className="px-5 py-2.5 rounded-xl border border-[#D4A84F]/20 text-[#9EA7B8] hover:text-[#F8F9FB] text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-black shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري استعادة البيانات...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                    <span>تأكيد الاستعادة والبدء</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
