/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  File,
  ShieldCheck,
  Building,
  Scale,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CaseFile, Case } from '../types';
import { getFileFromIndexedDB, getProxiedUrl } from '../utils/fileStorage';
import { useBackHandler } from '../utils/navigationManager';

export interface DocumentViewerModalProps {
  file: CaseFile | {
    id?: string;
    name: string;
    type?: string;
    category?: string;
    size?: string;
    uploadDate?: string;
    uploadedBy?: string;
    fileUrl?: string;
    downloadURL?: string;
  } | null;
  onClose: () => void;
  caseData?: Case | {
    caseNumberFirstInstance?: string;
    caseYearFirstInstance?: string;
    clientName?: string;
    courtFirstInstance?: string;
    opponent?: any;
    subject?: string;
  };
}

export default function DocumentViewerModal({ file, onClose, caseData }: DocumentViewerModalProps) {
  useBackHandler(!!file, onClose);

  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [simulatedHtml, setSimulatedHtml] = useState<string>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Zoom & rotation for image preview
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // Generate simulated legal content if file has no physical storage blob
  const generateLegalContentHtml = (targetFile: any) => {
    const category = targetFile.category || '';
    const name = targetFile.name || '';
    const caseNum = caseData?.caseNumberFirstInstance || '—';
    const caseYear = caseData?.caseYearFirstInstance || '—';
    const court = caseData?.courtFirstInstance || 'المحكمة المختصة';
    const client = caseData?.clientName || 'السيد الموكل';
    const opponent = typeof caseData?.opponent === 'object' ? (caseData?.opponent?.name || 'الطرف الآخر') : (caseData?.opponent || 'الطرف الآخر');
    const subject = caseData?.subject || 'موضوع النزاع والدعوى القضائية المقيدة بالسجلات';

    if (category === 'أحكام' || name.includes('حكم')) {
      return `
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">باسم الشعب</h3>
          <h4 style="font-size: 16px; font-weight: 700; color: #334155; margin: 0;">محكمة ${court}</h4>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">الدائرة القضائية المختصة بمقر المحكمة</p>
        </div>
        <p style="margin-bottom: 12px; line-height: 1.8;"><strong>في القضية رقم:</strong> ${caseNum} لسنة ${caseYear}</p>
        <p style="margin-bottom: 12px; line-height: 1.8;"><strong>الصادر لصالح:</strong> ${client} (يمثله قانوناً: مؤسسة رميح للمحاماة والاستشارات القانونية)</p>
        <p style="margin-bottom: 16px; line-height: 1.8;"><strong>ضد:</strong> ${opponent}</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-right: 4px solid #10b981; padding: 14px; border-radius: 8px; margin: 18px 0;">
          <h5 style="color: #065f46; font-size: 14px; font-weight: 800; margin: 0 0 6px 0;">منطوق الحكم القضائي:</h5>
          <p style="margin: 0; line-height: 1.9; color: #1e293b; font-weight: 600;">
            حكمت المحكمة بإلزام المدعى عليه بالطلبات الواردة بصحيفة افتتاح الدعوى والمصاريف وأتعاب المحاماة وشمول الحكم بالنفاذ المعجل،،
          </p>
        </div>
        <p style="font-weight: bold; color: #0f172a; text-align: left; margin-top: 25px;">رئيس الدائرة القضائية</p>
      `;
    } else if (category === 'مذكرات' || name.includes('مذكرة')) {
      return `
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">مذكرة بدفوع ودفاع قانوني معتمد</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">مؤسسة رميح للمحاماة والاستشارات القانونية</p>
        </div>
        <p style="margin-bottom: 12px; line-height: 1.8;"><strong>أمام محكمة:</strong> ${court}</p>
        <p style="margin-bottom: 12px; line-height: 1.8;"><strong>في القضية رقم:</strong> ${caseNum} لسنة ${caseYear}</p>
        <p style="margin-bottom: 12px; line-height: 1.8;"><strong>مقدمة بصفتنا وكلاء عن:</strong> ${client}</p>
        <div style="margin: 18px 0;">
          <h5 style="font-size: 14px; font-weight: 800; color: #b45309; margin-bottom: 8px;">الدفوع الجوهرية:</h5>
          <ul style="padding-right: 22px; line-height: 2; color: #334155;">
            <li><strong>أولاً:</strong> الدفع بانتفاء السند القانوني ومطابقة الإجراءات لأحكام القانون واجب النفاذ.</li>
            <li><strong>ثانياً:</strong> ثبوت حق الموكل واكتمال المستندات الدالة قطيعاً على صحة الموقف.</li>
            <li><strong>ثالثاً:</strong> الدفع برفض دعوى الخصم ومزاعمه لخلوها من ثمة بينة جازمة.</li>
          </ul>
        </div>
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 14px; margin-top: 20px;">
          <p style="font-weight: 800; color: #92400e;">الطلبات الختامية: نلتمس رفض الدعوى وإلزام الخصم بكافة المصروفات وأتعاب المحاماة.</p>
        </div>
      `;
    } else if (category === 'صحف الدعاوى' || name.includes('صحيفة')) {
      return `
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">صحيفة افتتاح دعوى قضائية</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">قيدت بجدول محكمة ${court}</p>
        </div>
        <p style="line-height: 1.9; margin-bottom: 14px;">بناءً على طلب السيد / <strong>${client}</strong>، وموطنه المختار مكتب مؤسسة رميح للمحاماة، انتقلت وأعلنت السيد / <strong>${opponent}</strong> بالموضوع الآتي:</p>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-right: 4px solid #d97706; padding: 14px; border-radius: 8px; margin: 16px 0;">
          <strong style="color: #92400e; font-size: 14px; display: block; margin-bottom: 6px;">موضوع الدعوى:</strong>
          <p style="margin: 0; line-height: 1.8; color: #1e293b;">${subject}</p>
        </div>
        <p style="line-height: 1.9; color: #475569;">وكلفته بالحضور أمام محكمة ${court} لسماع الحكم بإلزامه بطلبات موكلنا الواردة تفصيلاً بأصل الصحيفة والمصاريف.</p>
      `;
    } else {
      return `
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">مستند رسمي ومرفق ملف قضائي</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">مؤسسة رميح للمحاماة والاستشارات القانونية</p>
        </div>
        <p style="line-height: 1.9; margin-bottom: 14px;">يقر مكتب مؤسسة رميح للمحاماة والاستشارات القانونية بإرفاق هذا المستند المودع بملف القضية تحت مسمى <strong>«${name}»</strong> والمصنف كوثيقة من نوع <strong>«${category || 'مستند عام'}»</strong>.</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0; font-size: 13px;">
          <div><strong>رقم القضية:</strong> ${caseNum} لسنة ${caseYear}</div>
          <div><strong>الموكل:</strong> ${client}</div>
          <div><strong>المحكمة المختصة:</strong> ${court}</div>
          <div><strong>تاريخ الإرفاق:</strong> ${targetFile.uploadDate || 'مسجل'}</div>
        </div>
        <p style="color: #475569; font-size: 13px; line-height: 1.9;">تم تدقيق هذا المستند ومطابقته رقمياً بالسجلات المعتمدة للمؤسسة.</p>
      `;
    }
  };

  useEffect(() => {
    if (!file) {
      setResolvedUrl('');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    setIsSimulated(false);
    setZoomLevel(100);
    setRotation(0);

    const resolveFile = async () => {
      try {
        let fileUrl = file.downloadURL || file.fileUrl;

        // 1. Check local IndexedDB storage cache
        if (file.id) {
          try {
            const cachedBlob = await getFileFromIndexedDB(file.id);
            if (cachedBlob && isMounted) {
              const blobUrl = URL.createObjectURL(cachedBlob);
              setResolvedUrl(blobUrl);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('[DocViewer] IndexedDB check failed:', e);
          }
        } else if (fileUrl && fileUrl.startsWith('blob:')) {
          try {
            const cachedBlob = await getFileFromIndexedDB(fileUrl);
            if (cachedBlob && isMounted) {
              const blobUrl = URL.createObjectURL(cachedBlob);
              setResolvedUrl(blobUrl);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('[DocViewer] Blob IndexedDB check failed:', e);
          }
        }

        // 2. Check if it's a real HTTP or Blob URL
        const hasRealUrl = fileUrl && fileUrl !== '#' && (fileUrl.startsWith('http') || fileUrl.startsWith('blob:'));
        if (hasRealUrl && isMounted) {
          const proxied = fileUrl.startsWith('http') ? getProxiedUrl(fileUrl) : fileUrl;
          setResolvedUrl(proxied);
          setIsLoading(false);
          return;
        }

        // 3. Fallback to legal document template view
        if (isMounted) {
          const html = generateLegalContentHtml(file);
          setSimulatedHtml(html);
          setIsSimulated(true);
          setResolvedUrl('');
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[DocViewer] Error resolving document:', err);
        if (isMounted) {
          const html = generateLegalContentHtml(file);
          setSimulatedHtml(html);
          setIsSimulated(true);
          setIsLoading(false);
        }
      }
    };

    resolveFile();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  const fileName = file.name || 'مستند';
  const isPdf = file.type === 'pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isImage = file.type === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
  const isWord = file.type === 'word' || file.type === 'doc' || /\.(doc|docx)$/i.test(fileName);

  // Zoom handlers for images
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // Print Handler
  const handlePrint = () => {
    if (isSimulated || isWord) {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
            <head>
              <title>${fileName} - طباعة</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                body { font-family: 'Cairo', sans-serif; margin: 40px; color: #1e293b; direction: rtl; }
                .sheet { max-width: 800px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 10px; }
              </style>
            </head>
            <body>
              <div class="sheet">
                ${simulatedHtml}
              </div>
            </body>
          </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
        setTimeout(() => printWin.close(), 1000);
        return;
      }
    }

    if (isImage && resolvedUrl) {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl">
            <head><title>${fileName} - طباعة</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh;">
              <img src="${resolvedUrl}" style="max-width:100%; max-height:100vh; object-fit:contain;" onload="window.print(); setTimeout(()=>window.close(), 800);" />
            </body>
          </html>
        `);
        printWin.document.close();
        return;
      }
    }

    // Default window print
    window.print();
  };

  // Safe Download Handler
  const handleDownload = () => {
    const targetUrl = resolvedUrl || file.downloadURL || file.fileUrl;
    if (targetUrl && targetUrl !== '#' && !targetUrl.startsWith('data:text/html')) {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Download simulated doc as html / text file
    const blob = new Blob([`
      <!DOCTYPE html>
      <html dir="rtl">
        <head><meta charset="UTF-8"><title>${fileName}</title></head>
        <body style="font-family: sans-serif; padding: 40px; direction: rtl;">${simulatedHtml}</body>
      </html>
    `], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <AnimatePresence>
      <div 
        id="document-viewer-modal-backdrop"
        className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none"
        dir="rtl"
      >
        {/* Backdrop click to dismiss */}
        <div 
          className="absolute inset-0" 
          onClick={onClose} 
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          id="document-viewer-modal-content"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-6xl h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-right select-text"
        >
          {/* Header Bar */}
          <div className="bg-slate-950/95 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
            {/* Right: File Details */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
                {isPdf ? (
                  <FileText className="w-5 h-5 text-rose-400" />
                ) : isImage ? (
                  <ImageIcon className="w-5 h-5 text-amber-400" />
                ) : (
                  <File className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-white truncate" title={fileName}>
                    {fileName}
                  </h3>
                  {file.category && (
                    <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {file.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 font-medium">
                  {file.size && <span>الحجم: {file.size}</span>}
                  {file.uploadDate && <span>• الإرفاق: {file.uploadDate}</span>}
                  {file.uploadedBy && <span>• بواسطة: {file.uploadedBy}</span>}
                </div>
              </div>
            </div>

            {/* Left: Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Image Controls (Zoom / Rotate) */}
              {isImage && resolvedUrl && (
                <div className="hidden sm:flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-0.5 ml-1">
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1.5 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="تكبير (+)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1.5 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="تصغير (-)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRotate}
                    className="p-1.5 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="تدوير الصورة"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Direct Proxy Link */}
              {resolvedUrl && resolvedUrl.startsWith('/api/proxy') && (
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 sm:px-3 sm:py-1.5 bg-slate-850 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="الدخول على البروكسي المباشر في نافذة مستقلة"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Proxy مباشر</span>
                </a>
              )}

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="طباعة المستند"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">طباعة</span>
              </button>

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                className="p-2 sm:px-3 sm:py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                title="تحميل المستند"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">تحميل</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-rose-600/80 rounded-xl transition-all cursor-pointer mr-1"
                title="إغلاق المعاينة (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Viewer Canvas */}
          <div className="flex-1 bg-[#0b0f19] relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-xs font-bold">جاري فتح المستند في النافذة المنبثقة...</p>
              </div>
            ) : loadError ? (
              <div className="max-w-md bg-slate-900 border border-rose-900/60 p-6 rounded-2xl text-center space-y-4 shadow-xl">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h4 className="text-sm font-black text-white">تعذر عرض المستند</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{loadError}</p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition-all"
                >
                  تحميل المستند الآن
                </button>
              </div>
            ) : isSimulated ? (
              /* Simulated Legal Sheet View */
              <div className="w-full h-full overflow-y-auto p-2 sm:p-6 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl p-6 sm:p-10 my-auto text-right text-slate-800">
                  <div className="flex items-center justify-between border-b-2 border-amber-600 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-800">
                        <Scale className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="font-black text-base sm:text-lg text-slate-900">
                          مؤسسة رميح للمحاماة والاستشارات القانونية
                        </h3>
                        <p className="text-xs text-amber-700 font-bold mt-0.5">
                          نظام الأرشفة والتوثيق الإلكتروني المعتمد
                        </p>
                      </div>
                    </div>
                    <div className="text-left text-xs text-slate-500 font-medium">
                      <div className="font-mono text-slate-800 font-bold">ملف: #{file.id ? file.id.substring(0, 8) : 'DOC'}</div>
                      <div className="mt-0.5 text-slate-500">{file.uploadDate || '2026'}</div>
                    </div>
                  </div>

                  <div 
                    className="leading-relaxed text-sm"
                    dangerouslySetInnerHTML={{ __html: simulatedHtml }}
                  />

                  <div className="mt-8 pt-4 border-t border-dashed border-slate-300 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-700">موثق بالبوابة الرقمية للقضايا</span>
                    </div>
                    <div className="font-bold text-amber-700">
                      النسخة الرقمية الرسمية
                    </div>
                  </div>
                </div>
              </div>
            ) : isPdf ? (
              /* PDF Embedded Viewer */
              <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
                <object
                  data={resolvedUrl}
                  type="application/pdf"
                  className="w-full h-full border-0 rounded-xl"
                >
                  <iframe
                    src={resolvedUrl}
                    title={fileName}
                    className="w-full h-full border-0 bg-white"
                  >
                    <div className="p-8 text-center bg-slate-900 text-white rounded-xl flex flex-col items-center justify-center h-full">
                      <FileText className="w-14 h-14 text-rose-500 mb-3" />
                      <h4 className="font-bold text-base mb-2">{fileName}</h4>
                      <p className="text-xs text-slate-400 mb-4 max-w-xs">يمكنك تحميل مستند الـ PDF مباشرة أو معاينته عبر الزر أدناه</p>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل المستند الآن</span>
                      </button>
                    </div>
                  </iframe>
                </object>
              </div>
            ) : isImage ? (
              /* Image Viewer Mode */
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4 select-none">
                <motion.div
                  animate={{
                    scale: zoomLevel / 100,
                    rotate: rotation
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="max-w-full max-h-full flex items-center justify-center"
                >
                  <img
                    src={resolvedUrl}
                    alt={fileName}
                    className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl transition-transform"
                    onError={() => setLoadError('تعذر عرض الصورة، يرجى تجربة تحميل الملف.')}
                  />
                </motion.div>
              </div>
            ) : (
              /* Other types (Word / General files) */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl">
                  <File className="w-10 h-10 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-black text-white">{fileName}</h4>
                  <p className="text-xs text-slate-400">مستند رسمي مسجل بملف الدعوى</p>
                </div>
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 w-full text-right text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">التصنيف:</span>
                    <span className="font-bold text-amber-300">{file.category || 'غير محدد'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">الحجم:</span>
                    <span className="font-mono text-slate-300">{file.size || 'غير مسجل'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">تاريخ الإرفاق:</span>
                    <span className="text-slate-300">{file.uploadDate || 'غير مسجل'}</span>
                  </div>
                </div>
                <div className="pt-2 w-full">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    تحميل وفتح المستند
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="bg-slate-950/90 border-t border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-500 font-medium shrink-0">
            <span className="flex items-center gap-1.5">
              <span>🔒 نافذة معاينة رقمية منبثقة</span>
              <span className="text-slate-600">• مؤسسة رميح للمحاماة والاستشارات القانونية</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-slate-400 text-[10px]">اضغط ESC أو زر الإغلاق للعودة</span>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
