/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Loader2, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Share2,
  FileCheck2
} from 'lucide-react';
import { 
  WHATSAPP_TARGET_PHONE,
  WHATSAPP_DISPLAY_PHONE,
  CaseDocumentShareItem, 
  CaseShareInfo, 
  DocumentFileResult,
  resolveDocumentFile, 
  canNativeShareFiles, 
  executeNativeFileShare, 
  openWhatsAppChat, 
  triggerDirectDownload, 
  formatBytes, 
  buildWhatsAppMessage, 
  getDocumentDirectShareUrl 
} from '../utils/whatsappShare';

export function WhatsAppIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

interface WhatsAppShareButtonProps {
  file: CaseDocumentShareItem;
  caseInfo?: CaseShareInfo;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'solid' | 'subtle';
  label?: string;
}

export default function WhatsAppShareButton({
  file,
  caseInfo,
  className = '',
  size = 'sm',
  variant = 'solid',
  label = 'مشاركة عبر واتساب'
}: WhatsAppShareButtonProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<DocumentFileResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccessBanner, setShareSuccessBanner] = useState(false);

  // Determine file icon
  const getFileIcon = (mimeType: string, fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (mimeType.includes('pdf') || ext === 'pdf') {
      return <FileText className="w-6 h-6 text-red-500 shrink-0" />;
    }
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return <ImageIcon className="w-6 h-6 text-blue-500 shrink-0" />;
    }
    if (ext === 'xlsx' || ext === 'xls') {
      return <FileSpreadsheet className="w-6 h-6 text-emerald-500 shrink-0" />;
    }
    return <FileCheck2 className="w-6 h-6 text-amber-500 shrink-0" />;
  };

  const handleButtonClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isResolving) return;

    try {
      setIsResolving(true);
      setShareSuccessBanner(false);

      // 1. Fetch and resolve genuine file in memory from Cloudflare R2 / IndexedDB
      const result = await resolveDocumentFile(file);
      setResolvedResult(result);

      // If file could not be fetched from storage, open modal with clear error message
      if (!result.file) {
        setShowModal(true);
        return;
      }

      // 2. Check if mobile browser supports native file sharing
      const hasNativeShare = canNativeShareFiles(result.file);

      if (hasNativeShare) {
        // Attempt native Web Share API
        const shareText = `مستند قضائي: ${result.fileName}\nمؤسسة رميح للمحاماة والاستشارات القانونية\nالمطلوب إرساله إلى رقم واتساب: ${WHATSAPP_DISPLAY_PHONE}`;
        const shareRes = await executeNativeFileShare(result.file, result.fileName, shareText);

        if (shareRes.success) {
          // Native share sheet was triggered successfully and user selected recipient
          setShareSuccessBanner(true);
          // Also open modal as confirmation assistant allowing direct chat with 01143472682
          setShowModal(true);
          return;
        }

        if (shareRes.aborted) {
          // User dismissed the OS share sheet voluntarily; open modal so they have alternative options
          setShowModal(true);
          return;
        }

        // Native share threw an error; open modal to provide alternative actions
        setShowModal(true);
      } else {
        // Desktop or non-supporting browser: open guided modal directly
        setShowModal(true);
      }
    } catch (err) {
      console.error('[WhatsAppShareButton] Resolution error:', err);
      setResolvedResult({
        file: null,
        blob: null,
        mimeType: '',
        fileName: file.name || 'مستند',
        sizeBytes: 0,
        error: 'حدث خطأ غير متوقع أثناء تجهيز المستند للمشاركة.',
        source: 'none'
      });
      setShowModal(true);
    } finally {
      setIsResolving(false);
    }
  };

  const handleTriggerNativeShareAgain = async () => {
    if (!resolvedResult?.file) return;
    const shareText = `مستند قضائي: ${resolvedResult.fileName}\nمؤسسة رميح للمحاماة والاستشارات القانونية\nرقم واتساب: ${WHATSAPP_DISPLAY_PHONE}`;
    const shareRes = await executeNativeFileShare(resolvedResult.file, resolvedResult.fileName, shareText);
    if (shareRes.success) {
      setShareSuccessBanner(true);
    }
  };

  const handleOpenWhatsAppDirect = () => {
    const directUrl = getDocumentDirectShareUrl(file);
    const msg = buildWhatsAppMessage(file, caseInfo, directUrl);
    openWhatsAppChat(WHATSAPP_TARGET_PHONE, msg);
  };

  const handleDownloadFile = () => {
    if (!resolvedResult?.file) return;
    triggerDirectDownload(resolvedResult.file);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleCopyLink = async () => {
    const directUrl = getDocumentDirectShareUrl(file);
    if (!directUrl) return;
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (_) {}
  };

  const sizeClasses = {
    xs: 'px-2 py-1 text-[10px] gap-1',
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-sm gap-2'
  }[size];

  const variantClasses = variant === 'solid'
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600/80 shadow-xs'
    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200';

  const directUrl = getDocumentDirectShareUrl(file);
  const isNativeSupported = resolvedResult?.file ? canNativeShareFiles(resolvedResult.file) : false;

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isResolving}
        className={`inline-flex items-center justify-center font-black rounded-lg transition-all cursor-pointer active:scale-95 disabled:opacity-60 select-none ${sizeClasses} ${variantClasses} ${className}`}
        title={`مشاركة المستند الأصلي عبر واتساب على الرقم ${WHATSAPP_DISPLAY_PHONE}`}
      >
        {isResolving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>جاري التجهيز...</span>
          </>
        ) : (
          <>
            <WhatsAppIcon className="w-3.5 h-3.5 shrink-0 text-white" />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* WhatsApp Share & Guided Attachment Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-emerald-100 w-full max-w-lg overflow-hidden text-right text-slate-800 my-auto"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <WhatsAppIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base leading-tight">مشاركة المستند عبر واتساب</h3>
                  <p className="text-[11px] text-emerald-100 font-medium">الرقم المستهدف: {WHATSAPP_DISPLAY_PHONE} (مؤسسة رميح للمحاماة)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Success Banner if shared via phone */}
              {shareSuccessBanner && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-emerald-900 text-xs">
                  <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-black block">تم تشغيل واجهة مشاركة الملف بنجاح!</span>
                    <span className="text-[11px] text-emerald-700">إذا اخترت تطبيق واتساب، فقد تم إرفاق المستند الأصلي فعلياً. يمكنك أيضاً فتح محادثة الرقم المباشر أدناه لتأكيد الاستلام.</span>
                  </div>
                </div>
              )}

              {/* Error Message if resolution failed */}
              {resolvedResult?.error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-900 text-xs">
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-black block">تعذر تحميل المستند الأصلي من التخزين السحابي</span>
                    <p className="text-[11px] text-rose-700 leading-relaxed">{resolvedResult.error}</p>
                    {directUrl && (
                      <p className="text-[11px] text-slate-600 pt-1">
                        يمكنك محاولة نسخ الرابط المباشر أدناه أو التحقق من اتصال الإنترنت.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* File Info Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {getFileIcon(resolvedResult?.mimeType || file.type || '', resolvedResult?.fileName || file.name)}
                  <div className="truncate">
                    <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate" title={resolvedResult?.fileName || file.name}>
                      {resolvedResult?.fileName || file.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                      <span>{file.category || 'مستند قضائي'}</span>
                      <span>•</span>
                      <span>{resolvedResult?.sizeBytes ? formatBytes(resolvedResult.sizeBytes) : (file.size || 'ملف رقمي')}</span>
                      {resolvedResult?.file && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">جاهز للإرسال ✅</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Case Context Details */}
              {caseInfo && (caseInfo.caseNumber || caseInfo.clientName) && (
                <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2.5 text-[11px] text-amber-900 flex flex-wrap gap-x-4 gap-y-1">
                  {caseInfo.caseNumber && (
                    <span><strong>رقم القضية:</strong> {caseInfo.caseNumber}{caseInfo.caseYear ? ` لسنة ${caseInfo.caseYear}` : ''}</span>
                  )}
                  {caseInfo.clientName && (
                    <span><strong>الموكل:</strong> {caseInfo.clientName}</span>
                  )}
                  {caseInfo.court && (
                    <span><strong>المحكمة:</strong> {caseInfo.court}</span>
                  )}
                </div>
              )}

              {/* Explanatory Note on Browser WhatsApp constraints */}
              <div className="bg-slate-100/70 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>ℹ️ إرشادات إرسال المستند للرقم {WHATSAPP_DISPLAY_PHONE}:</span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-600">
                  {isNativeSupported
                    ? 'متصفح هاتفك يدعم إرفاق الملفات الأصلية مباشرة عبر قائمة المشاركة (Share Sheet). اختر واتساب لإرسال الملف الفعلي.'
                    : 'متصفحات أجهزة الكمبيوتر تمنع إرفاق الملفات تلقائياً داخل محادثة واتساب عبر الروابط لأسباب أمنية. لقد قمنا بتجهيز الملف الأصلي في الذاكرة لتنزيله فوراً وإرفاقه في المحادثة.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {/* 1. If Native Share Supported: Direct OS Share Button */}
                {resolvedResult?.file && isNativeSupported && (
                  <button
                    type="button"
                    onClick={handleTriggerNativeShareAgain}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>إرفاق ومشاركة الملف عبر قائمة الهاتف (Share Sheet)</span>
                  </button>
                )}

                {/* 2. Primary WhatsApp Chat Button */}
                <button
                  type="button"
                  onClick={handleOpenWhatsAppDirect}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0 text-white" />
                  <span>فتح محادثة واتساب مع الرقم {WHATSAPP_DISPLAY_PHONE}</span>
                </button>

                {/* 3. Direct File Download Button (Memory Blob to Disk) */}
                {resolvedResult?.file && (
                  <button
                    type="button"
                    onClick={handleDownloadFile}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-amber-400 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer border border-amber-500/20"
                  >
                    {downloadSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-white">تم تنزيل المستند الأصلي لجهازك بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>تنزيل الملف الأصلي ({resolvedResult.fileName}) لإرفاقه يدوياً</span>
                      </>
                    )}
                  </button>
                )}

                {/* 4. Copy Direct Link Button */}
                {directUrl && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">تم نسخ الرابط</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>نسخ رابط المستند المباشر</span>
                        </>
                      )}
                    </button>

                    <a
                      href={directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="فتح المستند في نافذة مستقلة"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      <span>معاينة</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>مؤسسة رميح للمحاماة والاستشارات القانونية</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-2 py-1 rounded-md"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
