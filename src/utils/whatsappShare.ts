/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFileFromIndexedDB, saveFileToIndexedDB, getProxiedUrl } from './fileStorage';

export const WHATSAPP_TARGET_PHONE = '201143472682'; // 01143472682 (مصر)
export const WHATSAPP_DISPLAY_PHONE = '01143472682';

export interface CaseDocumentShareItem {
  id?: string;
  name: string;
  fileUrl?: string;
  downloadURL?: string;
  type?: string;
  size?: string;
  category?: string;
  uploadedBy?: string;
  storagePath?: string;
}

export interface CaseShareInfo {
  caseNumber?: string;
  caseYear?: string | number;
  clientName?: string;
  court?: string;
  subject?: string;
  officeFileNo?: string;
}

export interface DocumentFileResult {
  file: File | null;
  blob: Blob | null;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  error?: string;
  source: 'indexeddb' | 'r2-proxy' | 'direct-url' | 'data-uri' | 'none';
}

/**
 * Detect MIME type accurately preserving original format
 */
export function getFileMimeType(fileName: string, fallback?: string): string {
  const cleanName = (fileName || '').toLowerCase().trim();
  const ext = cleanName.split('.').pop() || '';

  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    txt: 'text/plain; charset=utf-8',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4'
  };

  if (mimeMap[ext]) {
    return mimeMap[ext];
  }
  return fallback || 'application/octet-stream';
}

/**
 * Ensure the filename preserves its original extension for proper OS/WhatsApp handling
 */
export function ensureFileNameWithExtension(fileName: string, mimeType?: string, fileType?: string): string {
  let name = (fileName || 'مستند').trim();
  const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(name);
  if (!hasExt) {
    if (mimeType === 'application/pdf' || fileType === 'pdf') {
      name += '.pdf';
    } else if (mimeType === 'image/jpeg' || fileType === 'jpg' || fileType === 'jpeg') {
      name += '.jpg';
    } else if (mimeType === 'image/png' || fileType === 'png') {
      name += '.png';
    } else if (mimeType === 'image/webp') {
      name += '.webp';
    } else if (mimeType?.includes('wordprocessingml') || fileType === 'word' || fileType === 'doc') {
      name += '.docx';
    } else if (mimeType === 'application/msword') {
      name += '.doc';
    } else if (fileType === 'image') {
      name += '.jpg';
    }
  }
  return name;
}

/**
 * Resolves the absolute direct URL to the document for sharing
 */
export function getDocumentDirectShareUrl(file: CaseDocumentShareItem): string {
  const rawUrl = file.downloadURL || file.fileUrl || '';
  if (!rawUrl || rawUrl === '#') return '';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // If rawUrl is already absolute HTTP/HTTPS
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    const proxied = getProxiedUrl(rawUrl);
    if (proxied.startsWith('http://') || proxied.startsWith('https://')) {
      return proxied;
    }
    return `${origin}${proxied.startsWith('/') ? '' : '/'}${proxied}`;
  }

  if (rawUrl.startsWith('/api/proxy')) {
    return `${origin}${rawUrl}`;
  }

  if (rawUrl.startsWith('/')) {
    return `${origin}${rawUrl}`;
  }

  return rawUrl;
}

/**
 * Fetches the binary file as a Blob and constructs a genuine File object
 * with the original filename and proper MIME type.
 * STRICTLY NEVER returns a fake text file: if the real file cannot be fetched,
 * it returns null with an explicit error description.
 */
export async function resolveDocumentFile(file: CaseDocumentShareItem): Promise<DocumentFileResult> {
  const originalName = file.name || 'مستند';
  let blob: Blob | null = null;
  let source: DocumentFileResult['source'] = 'none';

  // 1. Try local IndexedDB first for instant, offline or preloaded access
  if (file.id) {
    try {
      const dbBlob = await getFileFromIndexedDB(file.id);
      if (dbBlob && dbBlob.size > 0) {
        blob = dbBlob;
        source = 'indexeddb';
      }
    } catch (e) {
      console.warn('[resolveDocumentFile] IndexedDB warning:', e);
    }
  }

  // 2. Resolve candidates for URL fetch (Cloudflare R2, proxy, or direct)
  const candidateUrls: string[] = [];
  if (file.downloadURL && file.downloadURL !== '#') candidateUrls.push(file.downloadURL);
  if (file.fileUrl && file.fileUrl !== '#' && !candidateUrls.includes(file.fileUrl)) candidateUrls.push(file.fileUrl);
  if (file.storagePath && !candidateUrls.includes(file.storagePath)) candidateUrls.push(file.storagePath);

  for (const rawUrl of candidateUrls) {
    if (blob && blob.size > 0) break;

    // A. Data URI support
    if (rawUrl.startsWith('data:')) {
      try {
        const resp = await fetch(rawUrl);
        if (resp.ok) {
          blob = await resp.blob();
          source = 'data-uri';
          break;
        }
      } catch (_) {}
    }

    // B. Blob URL support (if active session)
    if (rawUrl.startsWith('blob:')) {
      try {
        const resp = await fetch(rawUrl);
        if (resp.ok) {
          blob = await resp.blob();
          source = 'data-uri';
          break;
        }
      } catch (_) {}
    }

    // C. Cloudflare R2 / Server Proxy fetch
    let targetUrl = rawUrl;
    // If it's a relative storage key like "uploads/..." or "cases/..."
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('/')) {
      targetUrl = `https://law-office-files.b4a4577efe20571572e0ffd097128138.r2.cloudflarestorage.com/${targetUrl}`;
    }

    // Route through server proxy to bypass CORS and ISP blocks
    const proxiedUrl = getProxiedUrl(targetUrl);
    try {
      const resp = await fetch(proxiedUrl);
      if (resp.ok) {
        const fetchedBlob = await resp.blob();
        if (fetchedBlob && fetchedBlob.size > 0) {
          blob = fetchedBlob;
          source = 'r2-proxy';
          break;
        }
      }
    } catch (proxyErr) {
      console.warn('[resolveDocumentFile] Proxy fetch error:', proxyErr);
    }

    // D. Direct fetch fallback if proxied attempt failed
    if (!blob && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
      try {
        const directResp = await fetch(targetUrl);
        if (directResp.ok) {
          const fetchedBlob = await directResp.blob();
          if (fetchedBlob && fetchedBlob.size > 0) {
            blob = fetchedBlob;
            source = 'direct-url';
            break;
          }
        }
      } catch (directErr) {
        console.warn('[resolveDocumentFile] Direct fetch error:', directErr);
      }
    }
  }

  // If no blob was found, return clear failure without creating dummy files
  if (!blob || blob.size === 0) {
    return {
      file: null,
      blob: null,
      mimeType: '',
      fileName: originalName,
      sizeBytes: 0,
      error: 'تعذر تحميل المستند الأصلي من التخزين السحابي Cloudflare R2. يرجى التحقق من اتصال الإنترنت أو صحة مسار الملف.',
      source: 'none'
    };
  }

  // Cache in IndexedDB for subsequent zero-latency access
  if (file.id && blob) {
    try {
      await saveFileToIndexedDB(file.id, blob);
    } catch (_) {}
  }

  const mimeType = getFileMimeType(originalName, blob.type);
  const finalFileName = ensureFileNameWithExtension(originalName, mimeType, file.type);

  try {
    const fileObj = new File([blob], finalFileName, { type: mimeType, lastModified: Date.now() });
    return {
      file: fileObj,
      blob,
      mimeType,
      fileName: finalFileName,
      sizeBytes: blob.size,
      source
    };
  } catch (_) {
    // If File constructor fails in older browser environment
    (blob as any).name = finalFileName;
    (blob as any).lastModifiedDate = new Date();
    return {
      file: blob as any,
      blob,
      mimeType,
      fileName: finalFileName,
      sizeBytes: blob.size,
      source
    };
  }
}

/**
 * Checks whether native file sharing is supported on this browser/device
 */
export function canNativeShareFiles(fileObj?: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    if (fileObj) {
      return navigator.canShare({ files: [fileObj] });
    }
    // Test with a dummy file if no file provided
    const testFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    return navigator.canShare({ files: [testFile] });
  } catch (_) {
    return false;
  }
}

/**
 * Executes native OS file share (triggers Share Sheet with attached file)
 */
export async function executeNativeFileShare(
  fileObj: File,
  title: string,
  text: string
): Promise<{ success: boolean; aborted?: boolean; error?: string }> {
  if (!canNativeShareFiles(fileObj)) {
    return {
      success: false,
      error: 'المتصفح الحالي لا يدعم إرفاق الملفات عبر واجهة المشاركة الأصلية (Web Share API).'
    };
  }

  try {
    await navigator.share({
      files: [fileObj],
      title,
      text
    });
    return { success: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, aborted: true };
    }
    return {
      success: false,
      error: err?.message || 'فشلت عملية المشاركة عبر النظام'
    };
  }
}

/**
 * Opens WhatsApp chat directly to the target number (01143472682)
 */
export function openWhatsAppChat(phone: string = WHATSAPP_TARGET_PHONE, text: string = ''): void {
  if (typeof window === 'undefined') return;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleanPhone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Triggers a real native download of the File in memory
 */
export function triggerDirectDownload(fileObj: File): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(fileObj);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileObj.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Formats file size in readable Arabic format
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 بايت';
  const k = 1024;
  const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Builds the comprehensive WhatsApp message text
 */
export function buildWhatsAppMessage(
  file: CaseDocumentShareItem,
  caseInfo?: CaseShareInfo,
  directUrl?: string
): string {
  const fileName = file.name || 'مستند قضائي';
  const category = file.category || file.type || 'مستند رسمي';

  let msg = `*مؤسسة رميح للمحاماة والاستشارات القانونية*\n`;
  msg += `السلام عليكم ورحمة الله وبركاته،\n`;
  msg += `مرفق لسيادتكم مستند رسمي:\n\n`;
  msg += `📄 *اسم المستند:* ${fileName}\n`;
  msg += `📁 *التصنيف:* ${category}\n`;

  if (caseInfo?.caseNumber) {
    msg += `⚖️ *رقم القضية:* ${caseInfo.caseNumber}${caseInfo.caseYear ? ` لسنة ${caseInfo.caseYear}` : ''}\n`;
  }
  if (caseInfo?.court) {
    msg += `🏛️ *المحكمة:* ${caseInfo.court}\n`;
  }
  if (caseInfo?.clientName) {
    msg += `👤 *الموكل:* ${caseInfo.clientName}\n`;
  }
  if (caseInfo?.subject) {
    msg += `📋 *الموضوع:* ${caseInfo.subject}\n`;
  }

  if (directUrl) {
    msg += `\n🔗 *رابط تحميل ومعاينة المستند بالصيغة الأصلية:*\n${directUrl}\n`;
  }

  msg += `\n_تمت المشاركة من المنظومة الرقمية لمؤسسة رميح للمحاماة (رقم التواصل: ${WHATSAPP_DISPLAY_PHONE})_`;
  return msg;
}
