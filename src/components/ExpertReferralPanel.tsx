import React, { useState } from 'react';
import { 
  UserCheck, Calendar, Gavel, FileText, CheckCircle2, Clock, 
  AlertTriangle, Plus, Edit3, Trash2, Download, Eye, Upload, 
  X, Check, ShieldAlert, FilePlus, Sparkles, FolderOpen, ArrowRight, Phone, MapPin, Building
} from 'lucide-react';
import { 
  Case, ExpertReferralInfo, ExpertSession, ExpertDocument, 
  ExpertRequest, ExpertReportData, ExpertActionLog, User as AppUser 
} from '../types';
import { uploadToR2, getProxiedUrl } from '../utils/fileStorage';

interface ExpertReferralPanelProps {
  localCase: Case;
  currentUser: AppUser;
  users: AppUser[];
  onUpdateCase: (updated: Case) => Promise<void> | void;
  logAction: (action: string, details: string) => Promise<void> | void;
}

export default function ExpertReferralPanel({
  localCase,
  currentUser,
  users,
  onUpdateCase,
  logAction
}: ExpertReferralPanelProps) {
  const expertData: ExpertReferralInfo = localCase.expertReferral || {
    isReferred: true,
    status: 'قيد مباشرة الخبير'
  };

  // Modals state
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<ExpertSession | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReturnToCourtConfirm, setShowReturnToCourtConfirm] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');

  // Edit Referral Info Form State
  const [infoForm, setInfoForm] = useState({
    referralDate: expertData.referralDate || '',
    courtOrCircuit: expertData.courtOrCircuit || localCase.court || '',
    referralReason: expertData.referralReason || '',
    expertOffice: expertData.expertOffice || '',
    fileNumber: expertData.fileNumber || '',
    expertName: expertData.expertName || '',
    expertPhone: expertData.expertPhone || '',
    firstSessionDate: expertData.firstSessionDate || '',
    notes: expertData.notes || ''
  });

  // Session Form State
  const [sessionForm, setSessionForm] = useState<{
    date: string;
    time: string;
    sessionType: string;
    location: string;
    decisionOrAction: string;
    nextSessionDate: string;
    status: string;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    sessionType: 'مناقشة',
    location: 'مكتب الخبراء',
    decisionOrAction: '',
    nextSessionDate: '',
    status: 'pending',
    notes: ''
  });

  // Document Form State
  const [docForm, setDocForm] = useState({
    title: '',
    submissionDate: new Date().toISOString().split('T')[0],
    submittedBy: currentUser.fullName || 'المحامي',
    notes: ''
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Request Form State
  const [requestForm, setRequestForm] = useState({
    requestText: '',
    requestedAt: new Date().toISOString().split('T')[0],
    deadlineDate: '',
    status: 'قيد التحضير',
    assignedLawyerName: currentUser.fullName || '',
    notes: ''
  });

  // Report Form State
  const [reportForm, setReportForm] = useState({
    depositDate: expertData.report?.depositDate || new Date().toISOString().split('T')[0],
    summary: expertData.report?.summary || '',
    resultStatus: expertData.report?.resultStatus || 'في صالح الموكل',
    lawyerNotes: expertData.report?.lawyerNotes || ''
  });
  const [reportPdf, setReportPdf] = useState<File | null>(null);
  const [isUploadingReport, setIsUploadingReport] = useState(false);

  // Helper to append Action Log
  const appendActionLog = (title: string, details: string) => {
    const newLog: ExpertActionLog = {
      id: `exp-log-${Date.now()}`,
      actionDate: new Date().toISOString().split('T')[0],
      actionTitle: title,
      actionDetails: details,
      performedBy: currentUser.fullName || currentUser.username
    };
    return [...(expertData.actionLogs || []), newLog];
  };

  // Handler: Save Referral Basic Info
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedReferral: ExpertReferralInfo = {
      ...expertData,
      isReferred: true,
      referralDate: infoForm.referralDate,
      courtOrCircuit: infoForm.courtOrCircuit,
      referralReason: infoForm.referralReason,
      expertOffice: infoForm.expertOffice,
      fileNumber: infoForm.fileNumber,
      expertName: infoForm.expertName,
      expertPhone: infoForm.expertPhone,
      firstSessionDate: infoForm.firstSessionDate,
      notes: infoForm.notes,
      actionLogs: appendActionLog('تحديث بيانات الإحالة', 'تم تعديل وتحديث البيانات الأساسية لقرار الإحالة والبيانات الخاصة بالخبير.')
    };

    const updatedCase: Case = {
      ...localCase,
      isReferredToExperts: true,
      expertReferral: updatedReferral
    };

    await onUpdateCase(updatedCase);
    await logAction('تحديث الخبراء', `تم حديث بيانات الإحالة للخبراء للقضية ${localCase.caseNumberFirstInstance}`);
    setShowEditInfoModal(false);
  };

  // Handler: Add / Edit Session
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.date) {
      alert('يرجى تحديد تاريخ الجلسة.');
      return;
    }

    let currentSessions = [...(expertData.sessions || [])];
    let actionName = '';

    if (editingSession) {
      currentSessions = currentSessions.map(s => s.id === editingSession.id ? {
        ...s,
        date: sessionForm.date,
        time: sessionForm.time,
        sessionType: sessionForm.sessionType,
        location: sessionForm.location,
        decisionOrAction: sessionForm.decisionOrAction,
        nextSessionDate: sessionForm.nextSessionDate || undefined,
        status: sessionForm.status,
        notes: sessionForm.notes
      } : s);
      actionName = `تعديل جلسة خبرة بتاريخ ${sessionForm.date}`;
    } else {
      const newSess: ExpertSession = {
        id: `exp-sess-${Date.now()}`,
        date: sessionForm.date,
        time: sessionForm.time,
        sessionType: sessionForm.sessionType as any,
        location: sessionForm.location,
        decisionOrAction: sessionForm.decisionOrAction,
        nextSessionDate: sessionForm.nextSessionDate || undefined,
        status: sessionForm.status as any,
        notes: sessionForm.notes,
        createdByName: currentUser.fullName,
        createdAt: new Date().toISOString()
      };
      currentSessions.push(newSess);
      actionName = `إضافة جلسة خبرة جديدة بتاريخ ${sessionForm.date}`;
    }

    const updatedReferral: ExpertReferralInfo = {
      ...expertData,
      sessions: currentSessions,
      actionLogs: appendActionLog(actionName, `تم تسجيل جلسة خبرة: ${sessionForm.sessionType} - القرار: ${sessionForm.decisionOrAction || 'لم يتخذ قرار بعد'}`)
    };

    const updatedCase: Case = {
      ...localCase,
      isReferredToExperts: true,
      expertReferral: updatedReferral
    };

    await onUpdateCase(updatedCase);
    await logAction('جلسات الخبراء', `${actionName} لقضية ${localCase.caseNumberFirstInstance}`);
    setShowSessionModal(false);
    setEditingSession(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('هل أنت تأكد من حذف هذه الجلسة من ملف الخبراء؟')) return;

    const currentSessions = (expertData.sessions || []).filter(s => s.id !== sessionId);
    const updatedReferral: ExpertReferralInfo = {
      ...expertData,
      sessions: currentSessions,
      actionLogs: appendActionLog('حذف جلسة خبرة', 'تم إلغاء وإزالة جلسة خبرة من السجل.')
    };

    const updatedCase: Case = {
      ...localCase,
      expertReferral: updatedReferral
    };

    await onUpdateCase(updatedCase);
    await logAction('حذف جلسة خبرة', `تم حذف جلسة خبرة لقضية ${localCase.caseNumberFirstInstance}`);
  };

  // Handler: Add Document
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.title.trim()) {
      alert('يرجى كتابة عنوان المستند.');
      return;
    }

    setIsUploadingDoc(true);
    try {
      let fileUrl = '';
      let fileName = '';

      if (docFile) {
        fileUrl = await uploadToR2(docFile);
        fileName = docFile.name;
      }

      const newDoc: ExpertDocument = {
        id: `exp-doc-${Date.now()}`,
        title: docForm.title,
        submissionDate: docForm.submissionDate,
        submittedBy: docForm.submittedBy,
        fileUrl,
        fileName,
        notes: docForm.notes
      };

      const currentDocs = [...(expertData.documents || []), newDoc];
      const updatedReferral: ExpertReferralInfo = {
        ...expertData,
        documents: currentDocs,
        actionLogs: appendActionLog('إيداع مستند للخبير', `تم إيداع مستند: "${docForm.title}" بتاريخ ${docForm.submissionDate}`)
      };

      const updatedCase: Case = {
        ...localCase,
        expertReferral: updatedReferral
      };

      await onUpdateCase(updatedCase);
      await logAction('مستندات الخبراء', `إيداع مستند "${docForm.title}" للخبير لقضية ${localCase.caseNumberFirstInstance}`);
      setShowDocModal(false);
      setDocForm({
        title: '',
        submissionDate: new Date().toISOString().split('T')[0],
        submittedBy: currentUser.fullName || 'المحامي',
        notes: ''
      });
      setDocFile(null);
    } catch (error: any) {
      alert('حدث خطأ أثناء رفع المستند: ' + (error.message || String(error)));
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Handler: Add Expert Request
  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.requestText.trim()) {
      alert('يرجى كتابة نص طلب الخبير.');
      return;
    }

    const newReq: ExpertRequest = {
      id: `exp-req-${Date.now()}`,
      requestText: requestForm.requestText,
      requestedAt: requestForm.requestedAt,
      deadlineDate: requestForm.deadlineDate || undefined,
      status: requestForm.status as any,
      assignedLawyerName: requestForm.assignedLawyerName,
      notes: requestForm.notes
    };

    const currentReqs = [...(expertData.requests || []), newReq];
    const updatedReferral: ExpertReferralInfo = {
      ...expertData,
      requests: currentReqs,
      actionLogs: appendActionLog('تسجيل طلب من الخبير', `تم تسجل طلب جديد من الخبير: "${requestForm.requestText}"`)
    };

    const updatedCase: Case = {
      ...localCase,
      expertReferral: updatedReferral
    };

    await onUpdateCase(updatedCase);
    await logAction('طلبات الخبراء', `تسجيل طلب جديد للخبير لقضية ${localCase.caseNumberFirstInstance}`);
    setShowRequestModal(false);
    setRequestForm({
      requestText: '',
      requestedAt: new Date().toISOString().split('T')[0],
      deadlineDate: '',
      status: 'قيد التحضير',
      assignedLawyerName: currentUser.fullName || '',
      notes: ''
    });
  };

  const handleUpdateRequestStatus = async (reqId: string, newStatus: string) => {
    const currentReqs = (expertData.requests || []).map(r => r.id === reqId ? { ...r, status: newStatus as any } : r);
    const updatedReferral: ExpertReferralInfo = {
      ...expertData,
      requests: currentReqs,
      actionLogs: appendActionLog('تحديث حالة طلب الخبير', `تغيرت حالة الطلب إلى "${newStatus}"`)
    };

    const updatedCase: Case = {
      ...localCase,
      expertReferral: updatedReferral
    };

    await onUpdateCase(updatedCase);
  };

  // Handler: Deposit Report
  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadingReport(true);
    try {
      let pdfUrl = expertData.report?.pdfUrl || '';
      let pdfName = expertData.report?.pdfName || '';

      if (reportPdf) {
        pdfUrl = await uploadToR2(reportPdf);
        pdfName = reportPdf.name;
      }

      const reportData: ExpertReportData = {
        depositDate: reportForm.depositDate,
        summary: reportForm.summary,
        resultStatus: reportForm.resultStatus,
        lawyerNotes: reportForm.lawyerNotes,
        pdfUrl,
        pdfName
      };

      const updatedReferral: ExpertReferralInfo = {
        ...expertData,
        status: 'تم إيداع التقرير',
        report: reportData,
        actionLogs: appendActionLog('إيداع تقرير الخبير الرسمي', `تم تسجيل إيداع تقرير الخبير بتاريخ ${reportForm.depositDate} والنتيجة: ${reportForm.resultStatus}`)
      };

      const updatedCase: Case = {
        ...localCase,
        status: 'تم إيداع تقرير الخبير',
        expertReferral: updatedReferral
      };

      await onUpdateCase(updatedCase);
      await logAction('تقرير الخبراء', `تم إيداع تقرير الخبير رسميًا لقضية ${localCase.caseNumberFirstInstance}`);
      setShowReportModal(false);
    } catch (error: any) {
      alert('حدث خطأ أثناء حفظ تقرير الخبير: ' + (error.message || String(error)));
    } finally {
      setIsUploadingReport(false);
    }
  };

  // Handler: Return Case to Court (إعادة القضية للمحكمة)
  const handleConfirmReturnToCourt = async () => {
    const returnDate = new Date().toISOString().split('T')[0];
    const updatedReferral: ExpertReferralInfo = {
      ...expertData,
      status: 'تمت إعادة القضية للمحكمة',
      returnedToCourtAt: returnDate,
      returnedToCourtNotes: returnNotes,
      actionLogs: appendActionLog('إعادة القضية إلى المحكمة', `تمت إعادة ملف القضية لجدول جلسات المحكمة بعد انتهاء مرحلة الخبراء. ملاحظات الإعادة: ${returnNotes || 'لا توجد'}`)
    };

    const updatedCase: Case = {
      ...localCase,
      status: 'منظورة أمام المحكمة',
      isReferredToExperts: true, // Keep history preserved!
      expertReferral: updatedReferral
    };

    await onUpdateCase(updatedCase);
    await logAction('إعادة القضية للمحكمة', `تمت إعادة القضية رقم ${localCase.caseNumberFirstInstance} من مكتب الخبراء إلى جلسات المحكمة`);
    setShowReturnToCourtConfirm(false);
    setReturnNotes('');
  };

  const isReturned = expertData.status === 'تمت إعادة القضية للمحكمة';

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">

      {/* Top Banner & Status Card */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-850 to-slate-900 p-6 rounded-3xl border border-amber-500/20 text-white shadow-xl relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
              <UserCheck className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-black text-slate-100">
                  ملف إحالة القضية إلى الخبراء
                </h2>
                <span className={`text-xs font-black px-3 py-1 rounded-full border shadow-sm ${
                  isReturned
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : expertData.status === 'تم إيداع التقرير'
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                  • {expertData.status || 'قيد مباشرة الخبير'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                متابعة دقيقة وشاملة لدورة الخبراء: من قرار الإحالة والجلسات والمستندات والطلبات وحتى إيداع التقرير وإعادة الدعوى للمحكمة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center">
            {!isReturned && (
              <button
                onClick={() => setShowReturnToCourtConfirm(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Gavel className="w-4 h-4" />
                إعادة القضية للمحكمة 🏛️
              </button>
            )}
            {isReturned && (
              <div className="px-3.5 py-2 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                تمت الإعادة لجدول المحكمة في {expertData.returnedToCourtAt || 'سابقاً'}
              </div>
            )}
            <button
              onClick={() => {
                setInfoForm({
                  referralDate: expertData.referralDate || '',
                  courtOrCircuit: expertData.courtOrCircuit || localCase.court || '',
                  referralReason: expertData.referralReason || '',
                  expertOffice: expertData.expertOffice || '',
                  fileNumber: expertData.fileNumber || '',
                  expertName: expertData.expertName || '',
                  expertPhone: expertData.expertPhone || '',
                  firstSessionDate: expertData.firstSessionDate || '',
                  notes: expertData.notes || ''
                });
                setShowEditInfoModal(true);
              }}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              تعديل بيانات القرار
            </button>
          </div>
        </div>
      </div>

      {/* Grid Section 1: Referral & Expert Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-black text-xs border-b border-slate-100 pb-2">
            <Calendar className="w-4 h-4" />
            قرار الإحالة والجهة
          </div>
          <div className="text-xs space-y-2">
            <p className="flex justify-between">
              <span className="text-slate-500">تاريخ القرار:</span>
              <strong className="text-slate-800 font-mono">{expertData.referralDate || 'غير مدون'}</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">المحكمة / الدائرة:</span>
              <strong className="text-slate-800">{expertData.courtOrCircuit || localCase.court || 'غير مدون'}</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">سبب الإحالة:</span>
              <strong className="text-slate-800">{expertData.referralReason || 'غير مدون'}</strong>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-black text-xs border-b border-slate-100 pb-2">
            <Building className="w-4 h-4" />
            مكتب ورقم ملف الخبراء
          </div>
          <div className="text-xs space-y-2">
            <p className="flex justify-between">
              <span className="text-slate-500">مكتب الخبراء المختص:</span>
              <strong className="text-slate-800">{expertData.expertOffice || 'غير محدد'}</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">رقم ملف الخبراء:</span>
              <strong className="text-slate-800 font-mono">{expertData.fileNumber || 'غير محدد'}</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">أول جلسة خبرة:</span>
              <strong className="text-slate-800 font-mono">{expertData.firstSessionDate || 'غير محددة'}</strong>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-black text-xs border-b border-slate-100 pb-2">
            <UserCheck className="w-4 h-4" />
            بيانات الخبير وتواصله
          </div>
          <div className="text-xs space-y-2">
            <p className="flex justify-between">
              <span className="text-slate-500">اسم الخبير المنتدب:</span>
              <strong className="text-slate-800">{expertData.expertName || 'لم يعين بعد'}</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">هاتف الخبير:</span>
              <strong className="text-slate-800 font-mono">{expertData.expertPhone || 'غير مدون'}</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">ملاحظات الإحالة:</span>
              <strong className="text-slate-800 line-clamp-1">{expertData.notes || 'لا توجد'}</strong>
            </p>
          </div>
        </div>

      </div>

      {/* Grid Section 2: Expert Sessions Table (جدول جلسات الخبراء) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">سجل جلسات الخبراء المعاينة والمناقشة</h3>
              <p className="text-[11px] text-slate-500">جدول مستقل ومفصل لكافة المعاينات، مناقشة الأطراف، واستلام المستندات أمام الخبير.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingSession(null);
              setSessionForm({
                date: new Date().toISOString().split('T')[0],
                time: '10:00',
                sessionType: 'مناقشة',
                location: expertData.expertOffice || 'مكتب الخبراء',
                decisionOrAction: '',
                nextSessionDate: '',
                status: 'pending',
                notes: ''
              });
              setShowSessionModal(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            إضافة جلسة خبرة جديدة
          </button>
        </div>

        {(!expertData.sessions || expertData.sessions.length === 0) ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-400" />
            لا توجد جلسات خبرة مسجلة بعد. اضغط على "إضافة جلسة خبرة جديدة" لبدء التسجيل.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-150">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-200 font-black text-[11px]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">تاريخ ووقت الجلسة</th>
                  <th className="p-3">نوع الجلسة</th>
                  <th className="p-3">مكان الجلسة</th>
                  <th className="p-3">القرار أو الإجراء المتخذ</th>
                  <th className="p-3">الجلسة التالية</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {expertData.sessions.map((sess, index) => (
                  <tr key={sess.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-400 font-bold">{index + 1}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {sess.date} {sess.time && `@ ${sess.time}`}
                    </td>
                    <td className="p-3">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2.5 py-0.5 rounded-md">
                        {sess.sessionType}
                      </span>
                    </td>
                    <td className="p-3">{sess.location || 'مكتب الخبراء'}</td>
                    <td className="p-3 max-w-xs font-medium text-slate-800">
                      {sess.decisionOrAction || <span className="text-slate-400 italic">بانتظار الإجراء</span>}
                    </td>
                    <td className="p-3 font-mono text-amber-600 font-bold">
                      {sess.nextSessionDate || '-'}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sess.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : sess.status === 'postponed'
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {sess.status === 'completed' ? 'تمت' : sess.status === 'postponed' ? 'مؤجلة' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingSession(sess);
                            setSessionForm({
                              date: sess.date,
                              time: sess.time || '10:00',
                              sessionType: sess.sessionType,
                              location: sess.location,
                              decisionOrAction: sess.decisionOrAction || '',
                              nextSessionDate: sess.nextSessionDate || '',
                              status: sess.status,
                              notes: sess.notes || ''
                            });
                            setShowSessionModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                          title="تعديل / تسجيل قرار الجلسة"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(sess.id)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="حذف الجلسة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grid Section 3 & 4: Documents Submitted & Expert Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Documents Submitted to Expert */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-800">المستندات المقدمة للخبير</h3>
              </div>
              <button
                onClick={() => setShowDocModal(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                إيداع مستند
              </button>
            </div>

            {(!expertData.documents || expertData.documents.length === 0) ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                لم يتم تسجيل إيداع أية مستندات رسمية للخبير بعد.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {expertData.documents.map((doc) => (
                  <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{doc.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        تاريخ التقديم: <span className="font-mono">{doc.submissionDate}</span> • بواسطة: {doc.submittedBy || 'المحامي'}
                      </p>
                    </div>
                    {doc.fileUrl && (
                      <a
                        href={getProxiedUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 text-[10px] font-bold rounded-lg flex items-center gap-1 shrink-0"
                      >
                        <Eye className="w-3 h-3" />
                        عرض
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expert Requests */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-800">طلبات ومستندات مطلوب تقديمها للخبير</h3>
              </div>
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-[11px] rounded-xl flex items-center gap-1 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                تسجيل طلب
              </button>
            </div>

            {(!expertData.requests || expertData.requests.length === 0) ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                لا توجد طلبات معلقة من الخبير حتى الآن.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {expertData.requests.map((req) => (
                  <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">{req.requestText}</p>
                      <select
                        value={req.status}
                        onChange={(e) => handleUpdateRequestStatus(req.id, e.target.value)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-white border-slate-300 text-slate-800 outline-none"
                      >
                        <option value="قيد التحضير">قيد التحضير</option>
                        <option value="تم التقديم">تم التقديم</option>
                        <option value="مطلوب تعقيب">مطلوب تعقيب</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      تاريخ الطلب: <span className="font-mono">{req.requestedAt}</span>
                      {req.deadlineDate && ` • المهلة: ${req.deadlineDate}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Grid Section 5: Official Expert Report (تقرير الخبير الرسمى) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-850 text-white p-6 rounded-3xl border border-amber-500/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100">تقرير الخبير المنتدب المودع بالملف</h3>
              <p className="text-xs text-slate-400">تسجيل وتوثيق ملخص تقرير الخبير والنتيجة مع إرفاق نسخة PDF الرسمية للمراجعة والدفاع.</p>
            </div>
          </div>

          <button
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
          >
            <Upload className="w-4 h-4" />
            {expertData.report?.depositDate ? 'تحديث إيداع التقرير' : 'إيداع وتوثيق التقرير الرسمى 📄'}
          </button>
        </div>

        {expertData.report?.depositDate ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-xs text-slate-400">تاريخ الإيداع بالقلم الكتاب:</p>
              <p className="text-sm font-black font-mono text-amber-400">{expertData.report.depositDate}</p>
              <div className="pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400">نتيجة التقرير المبدئية:</p>
                <span className={`inline-block mt-1 text-xs font-black px-2.5 py-0.5 rounded-md border ${
                  expertData.report.resultStatus === 'في صالح الموكل'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : expertData.report.resultStatus === 'ضد الموكل'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {expertData.report.resultStatus || 'في صالح الموكل'}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2 md:col-span-2">
              <p className="text-xs text-slate-400">ملخص وأسباب تقرير الخبير:</p>
              <p className="text-xs font-medium text-slate-200 whitespace-pre-wrap leading-relaxed">
                {expertData.report.summary || 'لا يوجد ملخص مدون بعد.'}
              </p>
              {expertData.report.lawyerNotes && (
                <div className="mt-3 pt-2 border-t border-slate-800/80">
                  <p className="text-[11px] text-amber-400 font-bold">ملاحظات وتعقيب المحامي المسؤول:</p>
                  <p className="text-xs text-slate-300 mt-0.5">{expertData.report.lawyerNotes}</p>
                </div>
              )}
              {expertData.report.pdfUrl && (
                <div className="pt-3">
                  <a
                    href={getProxiedUrl(expertData.report.pdfUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-xl hover:bg-amber-500/30 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    تحميل/معاينة نسخة PDF التقرير الرسمية ({expertData.report.pdfName || 'تقرير الخبير'})
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            لم يتم إيداع تقرير الخبير الرسمي بالملف حتى الآن. اضغط على "إيداع وتوثيق التقرير الرسمى" للتسجيل.
          </div>
        )}
      </div>

      {/* Grid Section 6: Chronological Expert Action Logs (سجل الإجراءات) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Clock className="w-4 h-4 text-amber-500" />
          سجل التغيرات والإجراءات التاريخية للخبراء
        </h3>
        {(!expertData.actionLogs || expertData.actionLogs.length === 0) ? (
          <p className="text-xs text-slate-400 italic">لا توجد إجراءات مسجلة بالسجل بعد.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {expertData.actionLogs.slice().reverse().map((log) => (
              <div key={log.id} className="text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-150 flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-800">{log.actionTitle}:</span>
                  <span className="text-slate-600 mr-1.5">{log.actionDetails}</span>
                </div>
                <div className="text-[10px] text-slate-400 shrink-0 text-left font-mono">
                  {log.actionDate} • {log.performedBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================== MODALS ======================== */}

      {/* 1. Edit Referral Info Modal */}
      {showEditInfoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                تعديل البيانات الأساسية لقرار الإحالة والخبير
              </h3>
              <button onClick={() => setShowEditInfoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInfo} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ قرار الإحالة</label>
                  <input
                    type="date"
                    value={infoForm.referralDate}
                    onChange={(e) => setInfoForm({ ...infoForm, referralDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">المحكمة أو الدائرة</label>
                  <input
                    type="text"
                    placeholder="مثال: دائرة مدني كلي جنوب القاهرة"
                    value={infoForm.courtOrCircuit}
                    onChange={(e) => setInfoForm({ ...infoForm, courtOrCircuit: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">سبب قرار الإحالة</label>
                <input
                  type="text"
                  placeholder="مثال: احتساب الريع ونفي الغصب وتصفية الحسابات"
                  value={infoForm.referralReason}
                  onChange={(e) => setInfoForm({ ...infoForm, referralReason: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">مكتب الخبراء</label>
                  <input
                    type="text"
                    placeholder="مثال: مكتب خبراء وزارة العدل بالزيتون"
                    value={infoForm.expertOffice}
                    onChange={(e) => setInfoForm({ ...infoForm, expertOffice: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم ملف الخبراء</label>
                  <input
                    type="text"
                    placeholder="مثال: 1420 / 2026"
                    value={infoForm.fileNumber}
                    onChange={(e) => setInfoForm({ ...infoForm, fileNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم الخبير (اختياري)</label>
                  <input
                    type="text"
                    placeholder="اسم الخبير المنتدب"
                    value={infoForm.expertName}
                    onChange={(e) => setInfoForm({ ...infoForm, expertName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ أول جلسة خبرة (إن وجد)</label>
                  <input
                    type="date"
                    value={infoForm.firstSessionDate}
                    onChange={(e) => setInfoForm({ ...infoForm, firstSessionDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ملاحظات الإحالة</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات تفصيلية..."
                  value={infoForm.notes}
                  onChange={(e) => setInfoForm({ ...infoForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditInfoModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black rounded-xl"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add/Edit Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-amber-500" />
                {editingSession ? 'تعديل جلسة خبرة وتسجيل القرار' : 'إضافة جلسة خبرة جديدة'}
              </h3>
              <button onClick={() => setShowSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الجلسة</label>
                  <input
                    type="date"
                    required
                    value={sessionForm.date}
                    onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">وقت الجلسة</label>
                  <input
                    type="time"
                    value={sessionForm.time}
                    onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع الجلسة</label>
                  <select
                    value={sessionForm.sessionType}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="معاينة">معاينة</option>
                    <option value="مناقشة">مناقشة</option>
                    <option value="استلام مستندات">استلام مستندات</option>
                    <option value="سماع أقوال">سماع أقوال</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">حالة الجلسة</label>
                  <select
                    value={sessionForm.status}
                    onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="pending">لم تبدأ (قيد الانتظار)</option>
                    <option value="completed">تمت بنجاح</option>
                    <option value="postponed">مؤجلة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">مكان انعقاد الجلسة</label>
                <input
                  type="text"
                  placeholder="مقر مكتب الخبراء أو موقع العين محل النزاع"
                  value={sessionForm.location}
                  onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">القرار أو الإجراء المتخذ بالجلسة</label>
                <textarea
                  rows={2}
                  placeholder="مثال: تم إخلاء السبيل للمعاينة الميدانية وتأجيل الجلسة..."
                  value={sessionForm.decisionOrAction}
                  onChange={(e) => setSessionForm({ ...sessionForm, decisionOrAction: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">موعد الجلسة التالية (إن وجد)</label>
                <input
                  type="date"
                  value={sessionForm.nextSessionDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, nextSessionDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-amber-400 font-black rounded-xl"
                >
                  حفظ الجلسة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-amber-500" />
                إيداع مستند للخبير
              </h3>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">عنوان / اسم المستند</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حجة الملكية الأصلية / تقرير الاستشاري"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الإيداع</label>
                  <input
                    type="date"
                    value={docForm.submissionDate}
                    onChange={(e) => setDocForm({ ...docForm, submissionDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">جهة الإيداع</label>
                  <input
                    type="text"
                    value={docForm.submittedBy}
                    onChange={(e) => setDocForm({ ...docForm, submittedBy: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">مرفق الملف (اختياري)</label>
                <input
                  type="file"
                  onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl flex items-center gap-2"
                >
                  {isUploadingDoc ? 'جاري الرفع...' : 'حفظ المستند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                تسجيل طلب من الخبير
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">نص الطلب أو المستند المطلوب</label>
                <textarea
                  rows={3}
                  required
                  placeholder="مثال: تقديم أصل عقد الإيجار ورخصة البناء..."
                  value={requestForm.requestText}
                  onChange={(e) => setRequestForm({ ...requestForm, requestText: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الطلب</label>
                  <input
                    type="date"
                    value={requestForm.requestedAt}
                    onChange={(e) => setRequestForm({ ...requestForm, requestedAt: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">المهلة المحددة (إن وجدت)</label>
                  <input
                    type="date"
                    value={requestForm.deadlineDate}
                    onChange={(e) => setRequestForm({ ...requestForm, deadlineDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-amber-400 font-black rounded-xl"
                >
                  حفظ الطلب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Deposit Expert Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                إيداع وتوثيق تقرير الخبير الرسمي
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReport} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الإيداع بالقلم الكتاب</label>
                  <input
                    type="date"
                    required
                    value={reportForm.depositDate}
                    onChange={(e) => setReportForm({ ...reportForm, depositDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نتيجة التقرير لصلحة</label>
                  <select
                    value={reportForm.resultStatus}
                    onChange={(e) => setReportForm({ ...reportForm, resultStatus: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-bold"
                  >
                    <option value="في صالح الموكل">في صالح الموكل 🟢</option>
                    <option value="ضد الموكل">ضد الموكل 🔴</option>
                    <option value="محايد / إعادة للخبراء">محايد / إعادة للخبراء 🟡</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ملخص النتيجة والأسباب الرسمية للتقرير</label>
                <textarea
                  rows={3}
                  required
                  placeholder="اكتب خلاصة نتيجة تقرير الخبير هنا..."
                  value={reportForm.summary}
                  onChange={(e) => setReportForm({ ...reportForm, summary: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">ملاحظات وتعقيب المحامي المسؤول</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات الدفاع للرد على التقرير بالدعوى..."
                  value={reportForm.lawyerNotes}
                  onChange={(e) => setReportForm({ ...reportForm, lawyerNotes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">نسخة PDF التقرير الرسمية</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setReportPdf(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploadingReport}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl flex items-center gap-2"
                >
                  {isUploadingReport ? 'جاري الرفع...' : 'حفظ وإيداع التقرير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Return Case to Court Confirmation Modal */}
      {showReturnToCourtConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">إعادة القضية إلى جدول المحكمة</h3>
              <p className="text-xs text-slate-500 mt-1">
                تأكيد انتهاء مرحلة الخبراء وتغيير حالة القضية تلقائيًا إلى <strong className="text-slate-800 font-black font-mono">"منظورة أمام المحكمة"</strong>.
              </p>
            </div>

            <div className="text-right">
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الإعادة (اختياري)</label>
              <textarea
                rows={2}
                placeholder="مثال: تم إيداع التقرير وتحديد جلسة مرافعات ختامية أمام المحكمة بتاريخ..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              />
            </div>

            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-medium text-right">
              🔒 ملاحظة: سيظل سجل وجلسات ومستندات الخبراء محفوظًا بالكامل داخل ملف القضية الشامل ولن يتأثر إطلاقاً.
            </p>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReturnToCourtConfirm(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReturnToCourt}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer"
              >
                تأكيد الإعادة للمحكمة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
