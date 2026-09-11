import React, { useState, useRef, useEffect } from 'react';
import { 
  Paperclip, 
  X, 
  Upload, 
  FileText, 
  Eye, 
  Download, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Cloud, 
  Search, 
  FileCheck, 
  Plus, 
  Loader2,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Case, CaseFile, User as AppUser } from '../types';
import { uploadToR2, saveFileToIndexedDB, getFileFromIndexedDB, getProxiedUrl } from '../utils/fileStorage';
import DocumentViewerModal from './DocumentViewerModal';

export const DOCUMENT_TYPE_OPTIONS = [
  'صحيفة الدعوى',
  'محضر إعلان',
  'صورة حكم',
  'إنذار',
  'ملف الدعوى',
  'تحديد يدوي'
] as const;

export type DocumentTypeOption = typeof DOCUMENT_TYPE_OPTIONS[number];

interface QueuedUploadItem {
  id: string;
  file: File;
  category: string;
  customCategory: string;
  status: 'idle' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  downloadURL?: string;
}

interface CaseDocumentsModalProps {
  caseData: Case;
  currentUser: AppUser;
  onClose: () => void;
  onUpdateCase: (updatedCase: Case) => Promise<void> | void;
  logAction?: (action: string, details: string) => Promise<void> | void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileType(fileName: string, mimeType?: string): 'pdf' | 'word' | 'image' | 'doc' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext) || (mimeType && mimeType.includes('word'))) return 'word';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) || (mimeType && mimeType.startsWith('image/'))) return 'image';
  return 'doc';
}

export default function CaseDocumentsModal({
  caseData,
  currentUser,
  onClose,
  onUpdateCase,
  logAction
}: CaseDocumentsModalProps) {
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadItem[]>([]);
  const [defaultBatchType, setDefaultBatchType] = useState<string>('صحيفة الدعوى');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // In-app Document Viewer Popup State
  const [viewingFile, setViewingFile] = useState<CaseFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto clear feedback after 5 seconds
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Handle files selection
  const handleSelectFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: QueuedUploadItem[] = Array.from(files).map(file => ({
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      file,
      category: defaultBatchType,
      customCategory: '',
      status: 'idle',
      progress: 0
    }));

    setQueuedFiles(prev => [...prev, ...newItems]);
    setFeedbackMessage(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveQueuedItem = (id: string) => {
    setQueuedFiles(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItemCategory = (id: string, category: string) => {
    setQueuedFiles(prev => prev.map(item => item.id === id ? { ...item, category } : item));
  };

  const handleUpdateItemCustomCategory = (id: string, customCategory: string) => {
    setQueuedFiles(prev => prev.map(item => item.id === id ? { ...item, customCategory } : item));
  };

  const handleApplyBatchCategory = (newCat: string) => {
    setDefaultBatchType(newCat);
    setQueuedFiles(prev => prev.map(item => ({ ...item, category: newCat })));
  };

  // Upload queued files to Cloudflare R2 and persist directly to Firestore
  const handleStartUpload = async () => {
    if (queuedFiles.length === 0 || isUploading) return;

    // Validate that all custom types have text entered
    for (const item of queuedFiles) {
      if (item.category === 'تحديد يدوي' && !item.customCategory.trim()) {
        setFeedbackMessage({
          type: 'error',
          text: `يرجى كتابة نوع المستند للملف: ${item.file.name}`
        });
        return;
      }
    }

    setIsUploading(true);
    setFeedbackMessage(null);

    const newlyUploadedFiles: CaseFile[] = [];
    const updatedQueue = [...queuedFiles];

    try {
      for (let i = 0; i < updatedQueue.length; i++) {
        const item = updatedQueue[i];
        if (item.status === 'completed') continue;

        // Mark as uploading
        item.status = 'uploading';
        item.progress = 30;
        setQueuedFiles([...updatedQueue]);

        try {
          // 1. Upload to Cloudflare R2 via uploadToR2
          const downloadUrl = await uploadToR2(item.file);
          item.progress = 85;
          setQueuedFiles([...updatedQueue]);

          const finalCategory = item.category === 'تحديد يدوي' 
            ? (item.customCategory.trim() || 'مستند مخصص') 
            : item.category;

          const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const fileType = getFileType(item.file.name, item.file.type);
          
          const now = new Date();
          const uploadDate = now.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const newCaseFile: CaseFile = {
            id: fileId,
            name: item.file.name,
            type: fileType,
            category: finalCategory,
            uploadDate: uploadDate,
            size: formatFileSize(item.file.size),
            fileUrl: downloadUrl,
            downloadURL: downloadUrl,
            uploadedBy: currentUser.fullName || currentUser.username || 'المكتب'
          };

          // 2. Cache blob locally in permanent IndexedDB for immediate offline/fast access
          try {
            await saveFileToIndexedDB(fileId, item.file);
          } catch (cacheErr) {
            console.warn('[CaseDocumentsModal] IndexedDB cache warning:', cacheErr);
          }

          newlyUploadedFiles.push(newCaseFile);

          item.status = 'completed';
          item.progress = 100;
          item.downloadURL = downloadUrl;
          setQueuedFiles([...updatedQueue]);
        } catch (itemErr: any) {
          console.error(`[CaseDocumentsModal] Upload failed for ${item.file.name}:`, itemErr);
          item.status = 'failed';
          item.error = itemErr?.message || 'فشل الرفع';
          setQueuedFiles([...updatedQueue]);
        }
      }

      // If at least one file succeeded, save to Firestore via onUpdateCase
      if (newlyUploadedFiles.length > 0) {
        const currentFiles = caseData.files || [];
        const updatedCase: Case = {
          ...caseData,
          files: [...currentFiles, ...newlyUploadedFiles]
        };

        await onUpdateCase(updatedCase);

        if (logAction) {
          await logAction(
            'إرفاق مستندات',
            `تم إرفاق عدد (${newlyUploadedFiles.length}) مستند بملف القضية رقم ${caseData.caseNumberFirstInstance || caseData.officeFileNo} وحفظها سحابياً في Cloudflare R2 وربطها بـ Firestore`
          );
        }

        // Remove completed files from queue
        setQueuedFiles(prev => prev.filter(item => item.status !== 'completed'));

        setFeedbackMessage({
          type: 'success',
          text: `تم حفظ وإرفاق ${newlyUploadedFiles.length} مستند بنجاح في Cloudflare R2 وربطها بملف القضية سحابياً!`
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: 'تعذر رفع المستندات إلى التخزين السحابي. يرجى التحقق من الاتصال والمحاولة مرة أخرى.'
        });
      }
    } catch (err: any) {
      console.error('[CaseDocumentsModal] General upload error:', err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'حدث خطأ أثناء رفع المستندات.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // View document directly via Proxy without any intermediate barriers
  const handleViewDocument = (file: CaseFile) => {
    const rawUrl = file.downloadURL || file.fileUrl;
    if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
      const proxyUrl = getProxiedUrl(rawUrl);
      window.open(proxyUrl, '_blank');
      return;
    }
    if (file.id) {
      getFileFromIndexedDB(file.id).then(blob => {
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank');
        } else {
          setViewingFile(file);
        }
      }).catch(() => {
        setViewingFile(file);
      });
      return;
    }
    if (rawUrl && rawUrl.startsWith('blob:')) {
      window.open(rawUrl, '_blank');
      return;
    }
    setViewingFile(file);
  };

  // Download file safely without broken navigation
  const handleDownloadDocument = async (file: CaseFile) => {
    let fileUrl = file.downloadURL || file.fileUrl;
    let blobUrl = '';

    if (file.id) {
      const dbBlob = await getFileFromIndexedDB(file.id);
      if (dbBlob) {
        blobUrl = URL.createObjectURL(dbBlob);
      }
    }

    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (fileUrl && fileUrl.startsWith('http')) {
      const targetUrl = getProxiedUrl(fileUrl);
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = file.name || 'document';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // For simulated or placeholder documents, create a text blob to download
    const docContent = `مؤسسة رميح للمحاماة والاستشارات القانونية\nمستند: ${file.name}\nالتصنيف: ${file.category}\nالقضية: ${caseData.caseNumberFirstInstance || ''} لسنة ${caseData.caseYearFirstInstance || ''}\nالموكل: ${caseData.clientName || ''}\nالمحكمة: ${caseData.courtFirstInstance || ''}\nتاريخ الرفع: ${file.uploadDate}\nبواسطة: ${file.uploadedBy || 'المكتب'}\n\nهذا المستند معتمد وموثق إلكترونياً بنظام إدارة القضايا.`;
    const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name || 'مستند'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete file permanently from Case
  const handleConfirmDelete = async (fileId: string) => {
    const fileToDelete = (caseData.files || []).find(f => f.id === fileId);
    if (!fileToDelete) return;

    setIsDeleting(true);
    try {
      const remainingFiles = (caseData.files || []).filter(f => f.id !== fileId);
      const updatedCase: Case = {
        ...caseData,
        files: remainingFiles
      };

      await onUpdateCase(updatedCase);

      if (logAction) {
        await logAction(
          'حذف مستند',
          `تم حذف المستند (${fileToDelete.name}) من ملف القضية رقم ${caseData.caseNumberFirstInstance || caseData.officeFileNo}`
        );
      }

      setDeleteConfirmId(null);
      setFeedbackMessage({
        type: 'success',
        text: `تم حذف المستند (${fileToDelete.name}) بنجاح من ملف القضية.`
      });
    } catch (err: any) {
      console.error('[CaseDocumentsModal] Delete failed:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'تعذر حذف المستند. يرجى المحاولة مرة أخرى.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter current files
  const currentFiles = caseData.files || [];
  const filteredFiles = currentFiles.filter(file => {
    const matchesSearch = searchQuery.trim() === '' || 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.category && file.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (file.uploadedBy && file.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedTypeFilter === 'all' || file.category === selectedTypeFilter;

    return matchesSearch && matchesType;
  });

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'صحيفة الدعوى':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'محضر إعلان':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case 'صورة حكم':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'إنذار':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'ملف الدعوى':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      default:
        return 'bg-purple-100 text-purple-900 border-purple-300';
    }
  };

  const getFileIcon = (fileType: string, fileName: string) => {
    const isPdf = fileType === 'pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isWord = fileType === 'word' || fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx');
    const isImage = fileType === 'image' || ['jpg', 'jpeg', 'png', 'webp'].some(ext => fileName.toLowerCase().endsWith(ext));

    if (isPdf) return <FileText className="w-5 h-5 text-rose-600" />;
    if (isWord) return <FileText className="w-5 h-5 text-blue-600" />;
    if (isImage) return <ImageIcon className="w-5 h-5 text-emerald-600" />;
    return <FileText className="w-5 h-5 text-slate-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 md:p-6 overflow-y-auto" dir="rtl">
      <div 
        id="case-documents-manager-modal"
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-white">
                  إدارة وإرفاق مستندات القضية
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                  {currentFiles.length} مستند محفوظ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                القضية: {caseData.caseNumberFirstInstance || caseData.officeFileNo || 'بدون رقم'} لسنة {caseData.caseYearFirstInstance || '-'} • المحكمة: {caseData.court || 'غير محدد'} • الموكل: {caseData.clientName || 'غير محدد'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-emerald-400 font-bold">
              <Cloud className="w-3.5 h-3.5" />
              <span>تخزين سحابي R2 & Firestore</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className={`px-6 py-2.5 flex items-center gap-2 text-xs font-bold ${
            feedbackMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}>
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Modal Body - Scrollable */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* ================= SECTION 1: UPLOAD & ATTACH NEW DOCUMENTS ================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-black text-xs">
                  1
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  إرفاق مستند أو عدة مستندات جديدة
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                الصيغ المدعومة: PDF، Word (doc/docx)، الصور (JPG/PNG)
              </span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-amber-500 bg-amber-50/60 scale-[1.005]' 
                  : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/20 bg-slate-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => handleSelectFiles(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-black text-slate-800">
                    اضغط لاختيار المستندات أو اسحب وأفلت الملفات هنا
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    يمكنك اختيار ملف واحد أو عدة ملفات في نفس الوقت
                  </p>
                </div>
              </div>
            </div>

            {/* Queued Files List */}
            {queuedFiles.length > 0 && (
              <div className="mt-4 border-t border-slate-150 pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-amber-600" />
                    المستندات الجاهزة للإرفاق ({queuedFiles.length})
                  </span>

                  {/* Batch Type Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-600 font-bold">
                      نوع موحد للكل:
                    </label>
                    <select
                      value={defaultBatchType}
                      onChange={(e) => handleApplyBatchCategory(e.target.value)}
                      className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                    >
                      {DOCUMENT_TYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pl-1">
                  {queuedFiles.map((item) => (
                    <div 
                      key={item.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-right"
                    >
                      {/* File Name & Info */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {getFileIcon(getFileType(item.file.name), item.file.name)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-slate-900 truncate" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {formatFileSize(item.file.size)}
                          </p>
                        </div>
                      </div>

                      {/* Document Type Selector & Manual Input */}
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                            نوع المستند:
                          </label>
                          <select
                            value={item.category}
                            onChange={(e) => handleUpdateItemCategory(item.id, e.target.value)}
                            disabled={isUploading}
                            className="text-xs font-black bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                          >
                            {DOCUMENT_TYPE_OPTIONS.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </div>

                        {/* If 'تحديد يدوي' is selected, show manual input */}
                        {item.category === 'تحديد يدوي' && (
                          <div className="flex-1 md:w-56">
                            <input
                              type="text"
                              value={item.customCategory}
                              onChange={(e) => handleUpdateItemCustomCategory(item.id, e.target.value)}
                              disabled={isUploading}
                              placeholder="اكتب نوع المستند يدويًا..."
                              className="w-full text-xs font-bold bg-white border border-amber-400 rounded-lg px-2.5 py-1.5 text-slate-900 focus:ring-1 focus:ring-amber-500 focus:outline-hidden placeholder:text-slate-400 placeholder:font-normal"
                            />
                          </div>
                        )}

                        {/* Status / Progress or Remove Button */}
                        {item.status === 'uploading' ? (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold px-2 py-1 bg-amber-50 rounded-lg">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            <span>جاري الرفع...</span>
                          </div>
                        ) : item.status === 'completed' ? (
                          <div className="flex items-center gap-1 text-xs text-emerald-700 font-bold px-2 py-1 bg-emerald-50 rounded-lg">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تم الحفظ</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveQueuedItem(item.id)}
                            disabled={isUploading}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="إلغاء الملف"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Upload Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setQueuedFiles([])}
                    disabled={isUploading}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    تفريغ القائمة
                  </button>
                  <button
                    type="button"
                    onClick={handleStartUpload}
                    disabled={isUploading || queuedFiles.length === 0}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>جاري الحفظ والرفع السحابي...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 text-slate-950" />
                        <span>حفظ وإرفاق المستندات سحابياً ({queuedFiles.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ================= SECTION 2: CURRENT SAVED CASE DOCUMENTS ================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-black text-xs">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    المستندات والمرفقات المحفوظة بالملف ({currentFiles.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    مستندات مرتبطة بقاعدة بيانات Firestore ومخزنة سحابياً بـ Cloudflare R2
                  </p>
                </div>
              </div>

              {/* Filter and Search */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في المستندات..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-slate-800 focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">جميع الأنواع</option>
                  {DOCUMENT_TYPE_OPTIONS.filter(t => t !== 'تحديد يدوي').map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Documents Grid / Table */}
            {filteredFiles.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-bold">
                  {currentFiles.length === 0 
                    ? 'لم يتم إرفاق أي مستندات لهذه القضية حتى الآن.' 
                    : 'لا توجد مستندات مطابقة لمعايير البحث الحالية.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  استخدم قسم الإرفاق أعلاه لرفع المستندات وحفظها دائماً.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between text-right relative group"
                  >
                    <div>
                      {/* Top row: Name + Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {getFileIcon(file.type, file.name)}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-slate-900 truncate" title={file.name}>
                              {file.name}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {file.size || 'غير محدد'}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border whitespace-nowrap leading-tight ${getCategoryBadgeClass(file.category || '')}`}>
                          {file.category || 'غير محدد'}
                        </span>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100 font-medium">
                        <div>
                          <span className="text-slate-400 block text-[9px]">تاريخ الإرفاق:</span>
                          <span className="font-bold text-slate-700">
                            {file.uploadDate || 'غير مسجل'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">بواسطة:</span>
                          <span className="font-bold text-slate-700 truncate block" title={file.uploadedBy || 'المكتب'}>
                            {file.uploadedBy || 'المكتب'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between gap-2 mt-4 pt-2.5 border-t border-slate-100">
                      {(() => {
                        const fileRawUrl = file.downloadURL || file.fileUrl;
                        const directProxyUrl = fileRawUrl && (fileRawUrl.startsWith('http://') || fileRawUrl.startsWith('https://')) 
                          ? getProxiedUrl(fileRawUrl) 
                          : '';

                        return (
                          <div className="flex items-center gap-1.5">
                            {directProxyUrl ? (
                              <a
                                href={directProxyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-xs font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                                title="الدخول على البروكسي المباشر للمستند فوراً"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                <span>عرض / فتح</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleViewDocument(file)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-xs font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                                title="عرض المستند"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                <span>عرض / فتح</span>
                              </button>
                            )}

                            {directProxyUrl ? (
                              <a
                                href={directProxyUrl}
                                download={file.name || 'document'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                title="تحميل الملف للجهاز"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument(file)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                title="تحميل الملف للجهاز"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Delete button or confirmation */}
                      {deleteConfirmId === file.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(file.id)}
                            disabled={isDeleting}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-lg transition-all cursor-pointer"
                          >
                            {isDeleting ? 'حذف...' : 'تأكيد الحذف'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={isDeleting}
                            className="px-2 py-1 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(file.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا المستند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">مؤسسة رميح للمحاماة والاستشارات القانونية</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">نظام إدارة المستندات السحابي</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>

      {/* Integrated In-App Document Viewer Popup */}
      {viewingFile && (
        <DocumentViewerModal
          file={viewingFile}
          caseData={caseData}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  );
}
