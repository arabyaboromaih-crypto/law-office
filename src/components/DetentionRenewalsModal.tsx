import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Lock, 
  Calendar, 
  Gavel, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  FileText, 
  Info,
  Paperclip,
  Eye,
  Building2,
  Scale,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Case, DetentionRenewalRecord, InvestigationAttachment, CaseFile, User as AppUser } from '../types';
import { CourtSelect } from '../utils/courts';
import { saveFileToIndexedDB, getFileFromIndexedDB, getProxiedUrl, uploadToR2 } from '../utils/fileStorage';

interface DetentionRenewalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: Case;
  onUpdateCase: (updated: Case) => Promise<void> | void;
  currentUser?: AppUser;
  initialDate?: string;
}

// 2. سلطة إصدار قرار التجديد (خيارات محددة ومعتمدة)
export const AUTHORITY_OPTIONS = [
  'النيابة العامة',
  'القاضي الجزئي (محكمة الجنح الجزئية)',
  'محكمة الجنح المستأنفة (منعقدة في غرفة المشورة)',
  'محكمة الجنايات (منعقدة في غرفة المشورة)',
  'محكمة الجنايات المختصة',
  'قاضي التحقيق / مستشار الإحالة',
  'أخرى (تحديد يدوي)'
] as const;

// 4. الجهة المنظور أمامها التجديد القادم
export const NEXT_AUTHORITY_OPTIONS = [
  'النيابة العامة',
  'القاضي الجزئي (تجديد جزئي)',
  'محكمة الجنح المستأنفة (غرفة المشورة)',
  'محكمة الجنايات (غرفة المشورة)',
  'محكمة الموضوع (إحالة للمحكمة)',
  'النيابة الكلية',
  'لا توجد (إخلاء سبيل / إنهاء الحبس)',
  'أخرى (تحديد يدوي)'
] as const;

// 5. قرار محكمة التجديد اليوم (خيارات قانونية جاهزة ومعتمدة)
export const DECISION_OPTIONS = [
  'تجديد حبس المتهم 15 يوماً على ذمة التحقيقات',
  'تجديد حبس المتهم 45 يوماً على ذمة التحقيقات',
  'تجديد حبس المتهم 4 أيام على ذمة التحقيقات',
  'استمرار حبس المتهم وتحديد جلسة قادمة',
  'إخلاء سبيل المتهم بضمان مالي (كفالة)',
  'إخلاء سبيل المتهم بضمان محل إقامته',
  'إخلاء سبيل بتدبير احترازي',
  'رفض استئناف النيابة وتأييد إخلاء السبيل',
  'رفض استئناف المتهم وتأييد قرار الحبس',
  'قبول الاستئناف وإلغاء أمر الحبس وإخلاء السبيل',
  'إحالة القضية للمحاكمة الجنائية',
  'قرار مخصص (صيغة يدوية)'
] as const;

// 3. مدد سريعة لاحتساب الجلسة القادمة
export const QUICK_NEXT_OPTIONS = [
  { label: '+15 يوماً', days: 15 },
  { label: '+45 يوماً', days: 45 },
  { label: '+4 أيام', days: 4 },
  { label: '+أسبوع', days: 7 },
  { label: '+شهر', days: 30 }
];

export const DetentionRenewalsModal: React.FC<DetentionRenewalsModalProps> = ({
  isOpen,
  onClose,
  caseData,
  onUpdateCase,
  currentUser,
  initialDate
}) => {
  // Mode: form for recording/editing or list for cumulative history
  const [activeView, setActiveView] = useState<'form' | 'list'>('form');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Current session date being recorded
  const [sessionDate, setSessionDate] = useState<string>('');
  const [isEditingSessionDate, setIsEditingSessionDate] = useState(false);

  // ================= 7 FIELDS IN EXACT REQUIRED ORDER =================
  // 1. محكمة الانعقاد
  const [court, setCourt] = useState<string>('');

  // 2. سلطة إصدار قرار التجديد
  const [authority, setAuthority] = useState<string>(AUTHORITY_OPTIONS[0]);
  const [customAuthority, setCustomAuthority] = useState<string>('');

  // 3. الجلسة القادمة
  const [nextRenewalDate, setNextRenewalDate] = useState<string>('');

  // 4. الجهة المنظور أمامها التجديد القادم
  const [nextAuthority, setNextAuthority] = useState<string>(NEXT_AUTHORITY_OPTIONS[0]);
  const [customNextAuthority, setCustomNextAuthority] = useState<string>('');

  // 5. قرار محكمة التجديد اليوم
  const [decisionSelection, setDecisionSelection] = useState<string>(DECISION_OPTIONS[0]);
  const [decisionText, setDecisionText] = useState<string>(DECISION_OPTIONS[0]);

  // 6. ملاحظات
  const [notes, setNotes] = useState<string>('');

  // 7. إرفاق مستندات جلسة اليوم
  const [attachments, setAttachments] = useState<InvestigationAttachment[]>([]);
  const [pendingCaseFiles, setPendingCaseFiles] = useState<CaseFile[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status indicators
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const renewals = caseData.detentionRenewals || [];

  // Reset form to clean default state
  const resetForm = (customDate?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = customDate || today;

    setEditingRecordId(null);
    setSessionDate(targetDate);
    setIsEditingSessionDate(false);

    // 1. محكمة الانعقاد: default to case court or empty
    setCourt(caseData.court || caseData.courtFirstInstance || '');

    // 2. سلطة إصدار قرار التجديد
    setAuthority(AUTHORITY_OPTIONS[0]);
    setCustomAuthority('');

    // 3. الجلسة القادمة: default calculate +15 days
    const base = new Date(targetDate);
    if (!isNaN(base.getTime())) {
      base.setDate(base.getDate() + 15);
      setNextRenewalDate(base.toISOString().split('T')[0]);
    } else {
      setNextRenewalDate('');
    }

    // 4. الجهة المنظور أمامها التجديد القادم
    setNextAuthority(NEXT_AUTHORITY_OPTIONS[0]);
    setCustomNextAuthority('');

    // 5. قرار محكمة التجديد اليوم
    setDecisionSelection(DECISION_OPTIONS[0]);
    setDecisionText(DECISION_OPTIONS[0]);

    // 6. ملاحظات
    setNotes('');

    // 7. إرفاق مستندات جلسة اليوم
    setAttachments([]);
    setPendingCaseFiles([]);
  };

  // Open edit for an existing record
  const handleEditRecord = (record: DetentionRenewalRecord) => {
    setEditingRecordId(record.id);
    const recDate = record.date || record.renewalDate || new Date().toISOString().split('T')[0];
    setSessionDate(recDate);
    setIsEditingSessionDate(false);

    // 1. محكمة الانعقاد
    setCourt(record.court || caseData.court || '');

    // 2. سلطة إصدار قرار التجديد
    if (AUTHORITY_OPTIONS.includes(record.authority as any)) {
      setAuthority(record.authority);
      setCustomAuthority('');
    } else if (record.authority) {
      setAuthority('أخرى (تحديد يدوي)');
      setCustomAuthority(record.authority);
    } else {
      setAuthority(AUTHORITY_OPTIONS[0]);
      setCustomAuthority('');
    }

    // 3. الجلسة القادمة
    setNextRenewalDate(record.nextRenewalDate || '');

    // 4. الجهة المنظور أمامها التجديد القادم
    if (record.nextAuthority && NEXT_AUTHORITY_OPTIONS.includes(record.nextAuthority as any)) {
      setNextAuthority(record.nextAuthority);
      setCustomNextAuthority('');
    } else if (record.nextAuthority) {
      setNextAuthority('أخرى (تحديد يدوي)');
      setCustomNextAuthority(record.nextAuthority);
    } else {
      setNextAuthority(NEXT_AUTHORITY_OPTIONS[0]);
      setCustomNextAuthority('');
    }

    // 5. قرار محكمة التجديد اليوم
    if (record.decision && DECISION_OPTIONS.includes(record.decision as any)) {
      setDecisionSelection(record.decision);
      setDecisionText(record.decision);
    } else if (record.decision) {
      setDecisionSelection('قرار مخصص (صيغة يدوية)');
      setDecisionText(record.decision);
    } else {
      setDecisionSelection(DECISION_OPTIONS[0]);
      setDecisionText(DECISION_OPTIONS[0]);
    }

    // 6. ملاحظات
    setNotes(record.notes || '');

    // 7. إرفاق مستندات جلسة اليوم
    setAttachments(record.attachments || []);
    setPendingCaseFiles([]);

    setActiveView('form');
  };

  // Initialize on modal open or when target date changes
  useEffect(() => {
    if (isOpen) {
      setSuccessMessage(null);
      const renList = caseData.detentionRenewals || [];

      if (initialDate) {
        // Look for existing renewal on initialDate
        const existing = renList.find(r => (r.date || r.renewalDate) === initialDate);
        if (existing) {
          handleEditRecord(existing);
        } else {
          // New session for that specific initial date
          resetForm(initialDate);
          // Inherit previous authority/court if available
          const lastRec = renList[renList.length - 1];
          if (lastRec) {
            if (lastRec.court) setCourt(lastRec.court);
            if (lastRec.nextAuthority) {
              if (AUTHORITY_OPTIONS.includes(lastRec.nextAuthority as any)) {
                setAuthority(lastRec.nextAuthority);
              } else {
                setAuthority('أخرى (تحديد يدوي)');
                setCustomAuthority(lastRec.nextAuthority);
              }
            }
          }
          setActiveView('form');
        }
      } else {
        // If there are existing renewals, show list by default; otherwise open form
        if (renList.length > 0) {
          setActiveView('list');
        } else {
          resetForm();
          setActiveView('form');
        }
      }
    }
  }, [isOpen, caseData.id, initialDate]);

  if (!isOpen) return null;

  // Helper to add days to sessionDate for nextRenewalDate
  const handleQuickAddDays = (days: number) => {
    const base = new Date(sessionDate || new Date().toISOString().split('T')[0]);
    if (isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    setNextRenewalDate(base.toISOString().split('T')[0]);
  };

  // Handle file uploads for field 7
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingFiles(true);
    const newAtts: InvestigationAttachment[] = [];
    const newCaseFiles: CaseFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `det-att-${Date.now()}-${i}`;
      let downloadURL = '';

      // 1. Permanent IndexedDB storage
      try {
        await saveFileToIndexedDB(fileId, file);
      } catch (err) {
        console.warn('IndexedDB write warning:', err);
      }

      // 2. Upload to Cloudflare R2 if configured
      try {
        downloadURL = await uploadToR2(file);
      } catch (err) {
        console.warn('R2 upload skipped or offline, using local blob:', err);
      }

      const localBlobUrl = URL.createObjectURL(file);
      const effectiveUrl = downloadURL || localBlobUrl;

      const fileType = file.type.includes('pdf') 
        ? 'pdf' 
        : file.type.includes('image') 
          ? 'image' 
          : 'doc';

      const att: InvestigationAttachment = {
        id: fileId,
        name: file.name,
        url: effectiveUrl,
        fileUrl: effectiveUrl,
        downloadURL: downloadURL || undefined,
        type: fileType,
        size: Math.round(file.size / 1024)
      };

      const cf: CaseFile = {
        id: fileId,
        name: `جلسة تجديد ${sessionDate} - ${file.name}`,
        type: fileType,
        category: 'مستندات تجديد الحبس',
        uploadDate: sessionDate || new Date().toISOString().split('T')[0],
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        fileUrl: effectiveUrl,
        downloadURL: downloadURL || undefined,
        uploadedBy: currentUser?.fullName || 'محامٍ بالمكتب'
      };

      newAtts.push(att);
      newCaseFiles.push(cf);
    }

    setAttachments(prev => [...prev, ...newAtts]);
    setPendingCaseFiles(prev => [...prev, ...newCaseFiles]);
    setIsUploadingFiles(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Preview or open attachment in dedicated view
  const handleViewAttachment = async (att: InvestigationAttachment) => {
    let fileUrl = att.downloadURL || att.url || att.fileUrl;

    if (att.id) {
      try {
        const dbBlob = await getFileFromIndexedDB(att.id);
        if (dbBlob) {
          fileUrl = URL.createObjectURL(dbBlob);
        }
      } catch (err) {
        console.warn('Error reading from IndexedDB:', err);
      }
    }

    if (!fileUrl) {
      alert('رابط المستند غير متوفر.');
      return;
    }

    if (fileUrl.startsWith('http')) {
      window.open(getProxiedUrl(fileUrl), '_blank');
    } else {
      window.open(fileUrl, '_blank');
    }
  };

  // Remove attachment from currently edited session
  const handleRemoveAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
    setPendingCaseFiles(prev => prev.filter(f => f.id !== attId));
  };

  // Submit and Save Record
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!court.trim()) {
      alert('يرجى تحديد محكمة الانعقاد.');
      return;
    }

    const effectiveAuthority = authority === 'أخرى (تحديد يدوي)' ? customAuthority.trim() : authority;
    if (!effectiveAuthority) {
      alert('يرجى تحديد سلطة إصدار قرار التجديد.');
      return;
    }

    const effectiveNextAuthority = nextAuthority === 'أخرى (تحديد يدوي)' ? customNextAuthority.trim() : nextAuthority;
    const effectiveDecision = decisionSelection === 'قرار مخصص (صيغة يدوية)'
      ? decisionText.trim()
      : (decisionText.trim() || decisionSelection);

    setIsSaving(true);
    try {
      const recordId = editingRecordId || `ren-${Date.now()}`;

      const newRecord: DetentionRenewalRecord = {
        id: recordId,
        court: court.trim(),
        authority: effectiveAuthority,
        nextRenewalDate: nextRenewalDate ? nextRenewalDate.trim() : undefined,
        nextAuthority: effectiveNextAuthority ? effectiveNextAuthority.trim() : undefined,
        decision: effectiveDecision,
        notes: notes.trim(),
        date: sessionDate,
        renewalDate: sessionDate,
        attachments: attachments,
        renewalNumber: editingRecordId 
          ? (renewals.find(r => r.id === editingRecordId)?.renewalNumber || renewals.length)
          : renewals.length + 1
      };

      // Save cumulatively and independently: do not overwrite other sessions
      let updatedRenewals: DetentionRenewalRecord[];
      if (editingRecordId) {
        const originalRec = renewals.find(r => r.id === editingRecordId);
        const originalDate = originalRec?.date || originalRec?.renewalDate;

        // If date was changed to match a new hearing, save as new record rather than replacing historical date
        if (originalDate && originalDate !== sessionDate && (originalRec?.nextRenewalDate === sessionDate || originalRec?.decision)) {
          const recForNewDate: DetentionRenewalRecord = {
            ...newRecord,
            id: `ren-${Date.now()}`
          };
          updatedRenewals = [...renewals, recForNewDate];
        } else {
          updatedRenewals = renewals.map(r => r.id === editingRecordId ? newRecord : r);
        }
      } else {
        // Prevent duplicate for identical session date and authority
        const existsIndex = renewals.findIndex(r => (r.date || r.renewalDate) === sessionDate && r.authority === effectiveAuthority);
        if (existsIndex >= 0) {
          updatedRenewals = renewals.map((r, i) => i === existsIndex ? newRecord : r);
        } else {
          updatedRenewals = [...renewals, newRecord];
        }
      }

      // Sort renewals chronologically
      updatedRenewals.sort((a, b) => {
        const dateA = a.date || a.renewalDate || '';
        const dateB = b.date || b.renewalDate || '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

      // Synchronize files to case documents
      const currentFiles = caseData.files ? [...caseData.files] : [];
      pendingCaseFiles.forEach(pf => {
        if (!currentFiles.some(f => f.id === pf.id)) {
          currentFiles.push(pf);
        }
      });

      // Update case next hearing date if nextRenewalDate is set
      let updatedNextHearingDate = nextRenewalDate ? nextRenewalDate.trim() : caseData.nextHearingDate;
      if (!nextRenewalDate) {
        const latestNext = [...updatedRenewals]
          .filter(r => !!r.nextRenewalDate)
          .sort((a, b) => new Date(b.nextRenewalDate!).getTime() - new Date(a.nextRenewalDate!).getTime())[0];
        if (latestNext) {
          updatedNextHearingDate = latestNext.nextRenewalDate;
        }
      }

      const updatedCase: Case = {
        ...caseData,
        detentionRenewals: updatedRenewals,
        files: currentFiles,
        isInvestigationActive: true,
        ...(updatedNextHearingDate ? {
          nextHearingDate: updatedNextHearingDate,
          nextHearingTime: '09:00',
          nextHearingSubject: `جلسة تجديد حبس احتياطي (${effectiveNextAuthority || effectiveAuthority})`
        } : {})
      };

      await onUpdateCase(updatedCase);

      setSuccessMessage(editingRecordId ? 'تم تحديث جلسة التجديد بنجاح.' : 'تم تسجيل جلسة التجديد وربطها بالأجندة وملف القضية بنجاح.');
      setTimeout(() => setSuccessMessage(null), 3000);
      setActiveView('list');
    } catch (error) {
      console.error('Error saving detention renewal:', error);
      alert('حدث خطأ أثناء حفظ بيانات التجديد. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a specific renewal record
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف جلسة التجديد هذه من السجل؟')) {
      return;
    }

    try {
      const updatedRenewals = renewals.filter(r => r.id !== id);

      let newNextHearingDate: string | undefined = undefined;
      const latestWithNext = [...updatedRenewals]
        .filter(r => !!r.nextRenewalDate)
        .sort((a, b) => new Date(b.nextRenewalDate!).getTime() - new Date(a.nextRenewalDate!).getTime())[0];

      if (latestWithNext) {
        newNextHearingDate = latestWithNext.nextRenewalDate;
      }

      const updatedCase: Case = {
        ...caseData,
        detentionRenewals: updatedRenewals,
        nextHearingDate: newNextHearingDate
      };

      await onUpdateCase(updatedCase);
      setSuccessMessage('تم حذف جلسة التجديد وتحديث السجل.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting detention renewal:', error);
      alert('حدث خطأ أثناء حذف جلسة التجديد.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 text-right" 
      dir="rtl"
    >
      <div 
        id="detention-renewals-modal-container"
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
      >
        
        {/* ================= MODAL HEADER ================= */}
        <div className="bg-[#0B1528] text-white px-4 sm:px-6 py-4 border-b border-amber-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white truncate">
                  جلسة تجديد الحبس الاحتياطي
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 border border-amber-400/30 text-amber-300">
                  مرحلة التحقيق
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                {caseData.caseNumberFirstInstance ? `قضية رقم: ${caseData.caseNumberFirstInstance}` : ''}
                {caseData.clientName ? ` | الموكل: ${caseData.clientName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= TAB NAVIGATION BAR ================= */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveView('form');
              }}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'form'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingRecordId ? 'تعديل الجلسة' : 'تسجيل جلسة التجديد'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('list')}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'list'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>سجل الجلسات السابقة ({renewals.length})</span>
            </button>
          </div>

          {/* Current Session Date indicator badge */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>جلسة اليوم:</span>
            <span className="font-mono text-slate-900 font-black">{sessionDate || 'غير محدد'}</span>
            <button
              type="button"
              onClick={() => setIsEditingSessionDate(!isEditingSessionDate)}
              className="text-[11px] text-amber-700 hover:underline cursor-pointer mr-1"
              title="تعديل تاريخ انعقاد الجلسة"
            >
              (تغيير)
            </button>
          </div>
        </div>

        {/* Date editor toggle (when clicking تغيير) */}
        {isEditingSessionDate && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 flex items-center gap-3 text-xs animate-fadeIn shrink-0">
            <span className="font-black text-amber-950">تاريخ انعقاد هذه الجلسة:</span>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-mono font-bold text-xs text-slate-900 outline-none"
            />
            <button
              type="button"
              onClick={() => setIsEditingSessionDate(false)}
              className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              تأكيد التاريخ
            </button>
          </div>
        )}

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2 flex items-center gap-2 text-xs font-black text-emerald-900 animate-fadeIn shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ================= SCROLLABLE BODY ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60">
          
          {/* VIEW 1: THE 7 FIELDS IN EXACT REQUIRED ORDER */}
          {activeView === 'form' && (
            <form onSubmit={handleSaveRecord} className="space-y-4 sm:space-y-5 max-w-2xl mx-auto animate-fadeIn">
              
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                
                {/* 1. محكمة الانعقاد: اختيار من نموذج المحاكم المعتمد والموجود في قسم القضايا */}
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">1</span>
                    <span>محكمة الانعقاد:</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  <CourtSelect
                    value={court}
                    onChange={setCourt}
                    placeholder="اختر أو أدخل اسم المحكمة (نموذج المحاكم المعتمد)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    نموذج المحاكم المعتمد بقسم القضايا مع إمكانية التحديد اليدوي.
                  </p>
                </div>

                {/* 2. سلطة إصدار قرار التجديد: اختيار */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">2</span>
                    <span>سلطة إصدار قرار التجديد:</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={authority}
                      onChange={(e) => setAuthority(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
                    >
                      {AUTHORITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
                  </div>

                  {authority === 'أخرى (تحديد يدوي)' && (
                    <input
                      type="text"
                      value={customAuthority}
                      onChange={(e) => setCustomAuthority(e.target.value)}
                      placeholder="أدخل اسم سلطة إصدار القرار يدوياً..."
                      required
                      className="w-full mt-2 px-3.5 py-2 bg-white border border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-slate-900 outline-none"
                    />
                  )}
                </div>

                {/* 3. الجلسة القادمة: اختيار */}
                <div className="space-y-2 pt-2 border-t border-slate-100 bg-rose-50/40 border border-rose-200/70 p-3.5 rounded-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label className="block text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-rose-200 text-rose-950 flex items-center justify-center text-[11px] font-black">3</span>
                      <Calendar className="w-4 h-4 text-rose-700" />
                      <span>الجلسة القادمة:</span>
                    </label>
                    <span className="text-[10px] font-bold text-rose-800 bg-white border border-rose-200 px-2 py-0.5 rounded-md">
                      تُربط تلقائياً بالقضية والأجندة
                    </span>
                  </div>

                  {/* Quick selection presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">اختيار سريع:</span>
                    {QUICK_NEXT_OPTIONS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => handleQuickAddDays(q.days)}
                        className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-200 text-rose-950 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-3xs"
                      >
                        {q.label}
                      </button>
                    ))}
                    {nextRenewalDate && (
                      <button
                        type="button"
                        onClick={() => setNextRenewalDate('')}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        إلغاء الموعد (إخلاء سبيل)
                      </button>
                    )}
                  </div>

                  {/* Calendar Date Input */}
                  <div className="pt-1">
                    <input
                      type="date"
                      value={nextRenewalDate}
                      onChange={(e) => setNextRenewalDate(e.target.value)}
                      className="w-full sm:w-64 px-3.5 py-2 bg-white border border-rose-300 rounded-xl text-xs sm:text-sm font-mono font-black text-rose-950 focus:border-rose-500 outline-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* 4. الجهة المنظور أمامها التجديد القادم: اختيار */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">4</span>
                    <span>الجهة المنظور أمامها التجديد القادم:</span>
                  </label>
                  <div className="relative">
                    <select
                      value={nextAuthority}
                      onChange={(e) => setNextAuthority(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
                    >
                      {NEXT_AUTHORITY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
                  </div>

                  {nextAuthority === 'أخرى (تحديد يدوي)' && (
                    <input
                      type="text"
                      value={customNextAuthority}
                      onChange={(e) => setCustomNextAuthority(e.target.value)}
                      placeholder="أدخل اسم الجهة القادمة يدوياً..."
                      required
                      className="w-full mt-2 px-3.5 py-2 bg-white border border-amber-400 rounded-xl text-xs sm:text-sm font-bold text-slate-900 outline-none"
                    />
                  )}
                </div>

                {/* 5. قرار محكمة التجديد اليوم: اختيار */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">5</span>
                    <span>قرار محكمة التجديد اليوم:</span>
                    <span className="text-rose-600">*</span>
                  </label>
                  
                  {/* Dropdown with legal decision options */}
                  <div className="relative">
                    <select
                      value={decisionSelection}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDecisionSelection(val);
                        if (val !== 'قرار مخصص (صيغة يدوية)') {
                          setDecisionText(val);
                          // Auto calculate next date for 4, 15, 45 if selected
                          if (val.includes('15 يوماً')) handleQuickAddDays(15);
                          else if (val.includes('45 يوماً')) handleQuickAddDays(45);
                          else if (val.includes('4 أيام')) handleQuickAddDays(4);
                          else if (val.includes('إخلاء سبيل')) setNextRenewalDate('');
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all cursor-pointer appearance-none shadow-2xs"
                    >
                      {DECISION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
                  </div>

                  {/* Decision Text Box for full details / customizations */}
                  <div className="pt-1">
                    <textarea
                      rows={2.5}
                      value={decisionText}
                      onChange={(e) => setDecisionText(e.target.value)}
                      placeholder="منطوق القرار الصادر بجلسة اليوم..."
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* 6. ملاحظات: حقل كتابة حر */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">6</span>
                    <span>ملاحظات:</span>
                  </label>
                  <textarea
                    rows={2.5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب أي ملاحظات أو دفوع أو طلبات أُبديت في جلسة اليوم (حقل كتابة حر)..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-500 outline-none transition-all shadow-inner"
                  />
                </div>

                {/* 7. إرفاق مستندات جلسة اليوم: إمكانية إرفاق مستند واحد أو عدة مستندات */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 flex items-center justify-center text-[11px] font-black">7</span>
                      <Paperclip className="w-4 h-4 text-amber-600" />
                      <span>إرفاق مستندات جلسة اليوم:</span>
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">
                      مستند واحد أو عدة مستندات (PDF / صور / Word)
                    </span>
                  </div>

                  {/* Upload Dropzone / Trigger */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/70 hover:bg-amber-50/30 rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={handleFilesSelected}
                      className="hidden"
                    />
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-amber-600 shadow-2xs">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-slate-800">
                        {isUploadingFiles ? 'جاري تجهيز ورفع المستندات...' : 'اضغط لاختيار المستندات أو اسحبها هنا'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يتم ربط المستندات تلقائياً بجلسة اليوم وملف القضية مع إمكانية فتحها ومعاينتها لاحقاً.
                      </p>
                    </div>
                  </div>

                  {/* Attached Documents List with Open/Preview & Delete actions */}
                  {attachments.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-black text-slate-800">المستندات المرفقة ({attachments.length}):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attachments.map((att) => (
                          <div
                            key={att.id}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-3xs hover:border-amber-300 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate" title={att.name}>
                                  {att.name}
                                </p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {att.size ? `${att.size} KB` : 'مستند'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Open / Preview Button */}
                              <button
                                type="button"
                                onClick={() => handleViewAttachment(att)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg transition-colors cursor-pointer"
                                title="فتح ومعاينة المستند"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                                title="حذف المستند من الجلسة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  العودة للسجل
                </button>

                <button
                  type="submit"
                  disabled={isSaving || isUploadingFiles}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <span>جاري الحفظ والتزامن...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>حفظ قرار الجلسة وتحديث الأجندة</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

          {/* VIEW 2: CUMULATIVE HISTORICAL SESSIONS LIST */}
          {activeView === 'list' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    سجل جلسات تجديد الحبس الاحتياطي
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    يتم حفظ كل جلسة وقرار بشكل مستقل وتراكمي، مع الحفاظ على كافة السجلات السابقة.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveView('form');
                  }}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>تسجيل جلسة تجديد جديدة</span>
                </button>
              </div>

              {renewals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-slate-800">لا توجد جلسات تجديد مسجلة حتى الآن</h5>
                    <p className="text-[11px] text-slate-500 mt-1">
                      اضغط على زر «تسجيل جلسة تجديد جديدة» لإدخال بيانات الجلسة والمحكمة والقرار والمستندات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setActiveView('form');
                    }}
                    className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer hover:bg-amber-600 transition-all inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة أول جلسة تجديد</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {renewals.map((item, idx) => {
                    const sessionDateStr = item.date || item.renewalDate;

                    return (
                      <div
                        key={item.id || idx}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-amber-300 transition-all space-y-3"
                      >
                        {/* Top Card Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800 font-mono">
                              جلسة #{idx + 1}
                            </span>

                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-amber-600" />
                              <span className="font-mono">{sessionDateStr}</span>
                            </span>

                            {/* سلطة إصدار قرار التجديد */}
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/15 text-amber-950 border border-amber-500/30">
                              {item.authority || 'النيابة العامة'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditRecord(item)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="تعديل تفاصيل الجلسة"
                            >
                              <Edit className="w-3 h-3" />
                              <span>تعديل</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف من السجل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 1. محكمة الانعقاد */}
                        <div className="text-xs text-slate-700 flex items-center gap-2">
                          <span className="font-bold text-slate-400">محكمة الانعقاد:</span>
                          <span className="font-black text-slate-900">{item.court || caseData.court || 'المحكمة المختصة'}</span>
                        </div>

                        {/* 5. القرار الصادر */}
                        {item.decision ? (
                          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                              <Gavel className="w-3.5 h-3.5 text-amber-600" />
                              <span>قرار محكمة التجديد:</span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 leading-relaxed pr-5">
                              {item.decision}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-amber-50/50 border border-amber-200/60 p-2 rounded-xl text-xs font-bold text-amber-800">
                            بانتظار رصد قرار الجلسة
                          </div>
                        )}

                        {/* 6. الملاحظات */}
                        {item.notes && (
                          <div className="text-xs text-slate-600 bg-white border border-slate-150 p-2.5 rounded-xl">
                            <span className="font-bold text-slate-400">ملاحظات: </span>
                            <span>{item.notes}</span>
                          </div>
                        )}

                        {/* 7. مستندات جلسة اليوم */}
                        {item.attachments && item.attachments.length > 0 && (
                          <div className="bg-slate-50/80 border border-slate-200/70 p-2.5 rounded-xl space-y-1.5">
                            <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                              <span>المستندات المرفقة بالجلسة ({item.attachments.length}):</span>
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.attachments.map((att) => (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => handleViewAttachment(att)}
                                  className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-3xs"
                                  title="فتح ومعاينة المستند"
                                >
                                  <FileText className="w-3 h-3 text-amber-600" />
                                  <span className="truncate max-w-[150px]">{att.name}</span>
                                  <Eye className="w-3 h-3 text-slate-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 3 & 4. الجلسة القادمة والجهة المنظور أمامها */}
                        {item.nextRenewalDate && (
                          <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-black text-rose-950">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Calendar className="w-3.5 h-3.5 text-rose-600" />
                              <span>الجلسة القادمة:</span>
                              <span className="font-mono bg-white border border-rose-300 px-2 py-0.5 rounded-md text-rose-900 font-bold">
                                {item.nextRenewalDate}
                              </span>
                              {item.nextAuthority && (
                                <span className="bg-rose-100/80 border border-rose-200 text-rose-900 px-2 py-0.5 rounded-md text-[11px]">
                                  أمام: {item.nextAuthority}
                                </span>
                              )}
                            </div>

                            {/* Shortcut to record outcome of this upcoming session */}
                            {!renewals.some(r => r.id !== item.id && (r.date || r.renewalDate) === item.nextRenewalDate) && (
                              <button
                                type="button"
                                onClick={() => {
                                  resetForm(item.nextRenewalDate!);
                                  setCourt(item.court || caseData.court || '');
                                  if (item.nextAuthority) {
                                    if (AUTHORITY_OPTIONS.includes(item.nextAuthority as any)) {
                                      setAuthority(item.nextAuthority);
                                    } else {
                                      setAuthority('أخرى (تحديد يدوي)');
                                      setCustomAuthority(item.nextAuthority);
                                    }
                                  }
                                  setActiveView('form');
                                }}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-3xs active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                                <span>تسجيل قرار هذه الجلسة</span>
                              </button>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">يتم ربط كل جلسة وقرار ومستنداتها بالقضية والأجندة مع منع التكرار.</span>
            <span className="sm:hidden">تزامن فوري مع القضية والأجندة.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};

export default DetentionRenewalsModal;
