/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getFileFromIndexedDB, getProxiedUrl } from './fileStorage';

export const WHATSAPP_TARGET_PHONE = '201143472682'; // 01143472682 (مصر)

export interface CaseDocumentShareItem {
  id?: string;
  name: string;
  fileUrl?: string;
  downloadURL?: string;
  type?: string;
  size?: string;
  category?: string;
  uploadedBy?: string;
}

export interface CaseShareInfo {
  caseNumber?: string;
  caseYear?: string | number;
  clientName?: string;
  court?: string;
  subject?: string;
}

/**
 * Detect MIME type accurately preserving original format
 */
export function getFileMimeType(fileName: string, fallback?: string): string {
  const cleanName = (fileName || '').toLowerCase();
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
    txt: 'text/plain; charset=utf-8',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed'
  };

  if (mimeMap[ext]) {
    return mimeMap[ext];
  }
  return fallback || 'application/octet-stream';
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
 * Fetches the binary file as a Blob and constructs a standard File object
 * with the original filename and proper MIME type.
 */
export async function resolveDocumentFile(file: CaseDocumentShareItem): Promise<File | null> {
  const fileName = file.name || 'مستند';
  let blob: Blob | null = null;

  // 1. Try local IndexedDB first for instant access
  if (file.id) {
    try {
      const dbBlob = await getFileFromIndexedDB(file.id);
      if (dbBlob && dbBlob.size > 0) {
        blob = dbBlob;
      }
    } catch (e) {
      console.warn('[resolveDocumentFile] IndexedDB warning:', e);
    }
  }

  // 2. Fetch via proxy or direct URL if not in IndexedDB
  const rawUrl = file.downloadURL || file.fileUrl;
  if (!blob && rawUrl && rawUrl !== '#') {
    try {
      const targetUrl = rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')
        ? rawUrl
        : getProxiedUrl(rawUrl);

      const resp = await fetch(targetUrl);
      if (resp.ok) {
        blob = await resp.blob();
      }
    } catch (fetchErr) {
      console.warn('[resolveDocumentFile] Network fetch error:', fetchErr);
    }
  }

  // 3. Fallback: If blob could not be fetched (e.g. simulated doc), create informative text document
  if (!blob) {
    const fallbackText = `مؤسسة رميح للمحاماة والاستشارات القانونية\nالمستند: ${fileName}\nالتصنيف: ${file.category || 'مستند قضائي'}\nتم التحميل والتوثيق إلكترونياً.`;
    blob = new Blob([fallbackText], { type: 'text/plain; charset=utf-8' });
  }

  const mimeType = getFileMimeType(fileName, blob.type);
  try {
    return new File([blob], fileName, { type: mimeType, lastModified: Date.now() });
  } catch (_) {
    // If File constructor fails in older environment, attach properties to blob
    (blob as any).name = fileName;
    (blob as any).lastModifiedDate = new Date();
    return blob as any;
  }
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

  msg += `\n_تمت المشاركة من المنظومة الرقمية لمؤسسة رميح للمحاماة_`;
  return msg;
}

/**
 * Shares a case document directly via WhatsApp:
 * 1. Resolves the real binary file in its original format.
 * 2. Uses the native Web Share API (navigator.share) when supported on mobile phones
 *    to attach the actual file and share directly into WhatsApp.
 * 3. In all environments (or as fallback when file attachment is not supported directly by browser),
 *    opens WhatsApp on the specified phone number (01143472682) with the document link and details.
 */
export async function shareDocumentViaWhatsApp(
  file: CaseDocumentShareItem,
  caseInfo?: CaseShareInfo
): Promise<{ success: boolean; method: 'native-share' | 'whatsapp-web' | 'aborted' }> {
  const directUrl = getDocumentDirectShareUrl(file);
  const fileName = file.name || 'مستند';

  // Copy link to clipboard for convenience if supported
  if (directUrl && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(directUrl);
    } catch (_) {}
  }

  // 1. Try to prepare the physical File object for native file sharing
  let fileObj: File | null = null;
  try {
    fileObj = await resolveDocumentFile(file);
  } catch (err) {
    console.warn('[shareDocumentViaWhatsApp] File resolution warning:', err);
  }

  // 2. Check if mobile Web Share API supports file sharing
  const canShareFiles = typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    fileObj &&
    navigator.canShare({ files: [fileObj] });

  if (canShareFiles && fileObj) {
    try {
      const shareText = `مستند قضائي: ${fileName}\nمطلوب الإرسال إلى رقم واتساب: 01143472682\n\nرابط المستند:\n${directUrl || ''}`;
      await navigator.share({
        files: [fileObj],
        title: fileName,
        text: shareText
      });
      return { success: true, method: 'native-share' };
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User voluntarily dismissed the share sheet
        console.log('[shareDocumentViaWhatsApp] Native share dismissed by user');
        return { success: false, method: 'aborted' };
      }
      console.warn('[shareDocumentViaWhatsApp] Native share failed, falling back to direct chat:', shareErr);
    }
  }

  // 3. Direct WhatsApp chat link to phone 01143472682 (201143472682)
  const messageText = buildWhatsAppMessage(file, caseInfo, directUrl);
  const waUrl = `https://wa.me/${WHATSAPP_TARGET_PHONE}?text=${encodeURIComponent(messageText)}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  return { success: true, method: 'whatsapp-web' };
}
