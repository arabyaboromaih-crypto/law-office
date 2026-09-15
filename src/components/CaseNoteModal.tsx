import React, { useState } from 'react';
import { 
  X, MessageSquare, User, Calendar, Clock, Save, 
  Loader2, Trash2, CheckCircle2, ShieldCheck, FileText
} from 'lucide-react';
import { Case, CaseNote, User as AppUser } from '../types';
import { useBackHandler } from '../utils/navigationManager';

interface CaseNoteModalProps {
  isOpen: boolean;
  caseData: Case | null;
  currentUser: AppUser;
  onClose: () => void;
  onSaveNote: (note: CaseNote, updatedCase: Case) => Promise<void>;
  onDeleteNote?: (noteId: string, updatedCase: Case) => Promise<void>;
}

export default function CaseNoteModal({
  isOpen,
  caseData,
  currentUser,
  onClose,
  onSaveNote,
  onDeleteNote
}: CaseNoteModalProps) {
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useBackHandler(isOpen, () => {
    if (!isSaving) onClose();
  });

  if (!isOpen || !caseData) return null;

  const currentUserName = currentUser.fullName || currentUser.username || 'مستخدم النظام';
  const notesList = caseData.caseNotes || [];

  // Generate current Egyptian / Arabic date-time display
  const now = new Date();
  const currentDateDisplay = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(now);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = noteText.trim();
    if (!cleanText) {
      setErrorMessage('يرجى كتابة نص الملاحظة أولاً.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const nowISO = new Date().toISOString();
      const formattedDT = new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date());

      const newNote: CaseNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        text: cleanText,
        createdAt: nowISO,
        createdAtFormatted: formattedDT,
        createdBy: currentUserName,
        userId: currentUser.id,
        userRole: currentUser.title || currentUser.role
      };

      const updatedNotes = [newNote, ...notesList];
      const updatedCase: Case = {
        ...caseData,
        caseNotes: updatedNotes
      };

      await onSaveNote(newNote, updatedCase);
      setNoteText('');
      setSuccessMessage('تمت إضافة الملاحظة وحفظها بملف القضية بنجاح.');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err: any) {
      console.error('Error saving case note:', err);
      setErrorMessage('حدث خطأ أثناء حفظ الملاحظة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الملاحظة؟')) return;
    setDeletingId(noteId);
    try {
      const filteredNotes = notesList.filter(n => n.id !== noteId);
      const updatedCase: Case = {
        ...caseData,
        caseNotes: filteredNotes
      };
      if (onDeleteNote) {
        await onDeleteNote(noteId, updatedCase);
      } else {
        await onSaveNote(null as any, updatedCase);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('تعذر حذف الملاحظة.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
      dir="rtl"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div 
        className="bg-[#0F1D30] border-2 border-[#D4A84F]/60 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 text-right my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-[#D4A84F] to-amber-300" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#08111F] border-b border-white/10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md shrink-0">
              <MessageSquare className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-[#F8F9FB] tracking-tight">
                  إضافة ملاحظة على ملف القضية
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/40 font-mono">
                  {caseData.caseNumberFirstInstance} لسنة {caseData.caseYearFirstInstance}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-bold mt-1 flex items-center gap-2 flex-wrap">
                <span>الموكل: <strong className="text-white font-extrabold">{caseData.clientName}</strong></span>
                <span className="text-slate-500">•</span>
                <span>الخصم: <strong className="text-rose-300 font-bold">{caseData.opponent?.name || 'غير محدد'}</strong></span>
                {caseData.court && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-300 font-bold">{caseData.court}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[calc(85vh-160px)] overflow-y-auto">
          {/* Metadata Cards: User & Date-Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Author */}
            <div className="p-3.5 rounded-2xl bg-[#162740] border border-amber-500/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-300 font-bold block">مُضيف الملاحظة:</span>
                <span className="text-xs sm:text-sm font-black text-white">{currentUserName}</span>
                {currentUser.title && (
                  <span className="text-[10px] text-amber-300 font-bold block">({currentUser.title})</span>
                )}
              </div>
            </div>

            {/* Date and Time */}
            <div className="p-3.5 rounded-2xl bg-[#162740] border border-white/15 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-300 font-bold block">تاريخ ووقت الإضافة التلقائي:</span>
                <span className="text-xs sm:text-sm font-bold text-slate-100">{currentDateDisplay}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-white flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>نص الملاحظة المكتوبة يدويًا</span>
                  <span className="text-rose-400 font-bold">*</span>
                </span>
                <span className="text-[11px] text-slate-400">تُحفظ وتُرفق بملف القضية فوراً</span>
              </label>
              
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="اكتب هنا الملاحظة القانونية أو الإدارية الخاصة بملف هذه القضية بالتفصيل..."
                rows={4}
                className="w-full bg-[#08111F] border-2 border-[#D4A84F]/60 focus:border-[#D4A84F] focus:ring-2 focus:ring-[#D4A84F]/30 rounded-2xl p-4 text-[#F8F9FB] text-sm leading-relaxed font-medium placeholder:text-slate-500 focus:outline-none shadow-inner resize-y"
                disabled={isSaving}
                autoFocus
              />
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <X className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-black flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="submit"
                disabled={isSaving || !noteText.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A84F] via-amber-400 to-[#B38734] hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-[#D4A84F]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>جاري الحفظ والربط بالملف...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                    <span>إضافة الملاحظة</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Previous Notes Section */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>الملاحظات المسجلة بملف القضية ({notesList.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded-md">
                محفوظة ومسترجعة دائماً
              </span>
            </div>

            {notesList.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#08111F]/60 border border-dashed border-white/10 text-center text-slate-400 text-xs">
                <MessageSquare className="w-7 h-7 mx-auto mb-2 text-slate-500 opacity-60" />
                <p className="font-bold">لا توجد ملاحظات مسجلة على هذه القضية حتى الآن.</p>
                <p className="text-[11px] text-slate-500 mt-1">اكتب أول ملاحظة في النموذج أعلاه واضغط على زر «إضافة الملاحظة» لتوثيقها.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {notesList.map((note, index) => (
                  <div 
                    key={note.id || index}
                    className="p-3.5 rounded-2xl bg-[#162740] border border-white/10 hover:border-amber-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-300 border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[10px]">
                          {notesList.length - index}
                        </span>
                        <span className="font-black text-amber-200">{note.createdBy}</span>
                        {note.userRole && (
                          <span className="text-[10px] text-slate-400">({note.userRole})</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{note.createdAtFormatted || new Date(note.createdAt).toLocaleDateString('ar-EG')}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          disabled={deletingId === note.id}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                          title="حذف هذه الملاحظة"
                        >
                          {deletingId === note.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed whitespace-pre-line">
                      {note.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
