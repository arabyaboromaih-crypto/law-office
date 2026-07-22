/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Case, HearingSession } from '../types';

/**
 * Converts Arabic-Indic numerals (e.g., ٠١٢٣٤٥٦٧٨٩) to standard Western Arabic numerals (0-9).
 */
export function convertArabicIndicDigits(str: string): string {
  const map: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return str.replace(/[٠-٩]/g, (d) => map[d] || d);
}

/**
 * Scans a string for date patterns and returns them in YYYY-MM-DD format if found.
 * Supports:
 * - YYYY-MM-DD or YYYY/MM/DD
 * - DD-MM-YYYY or DD/MM/YYYY
 * - DD-MM or DD/MM (uses current year)
 */
export function extractHearingDate(text: string): string | null {
  if (!text) return null;
  
  const cleanText = convertArabicIndicDigits(text);
  
  // 1. Match YYYY-MM-DD or YYYY/MM/DD
  const ymdRegex = /(?:^|[^0-9])(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[^0-9])/;
  const ymdMatch = cleanText.match(ymdRegex);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. Match DD-MM-YYYY or DD/MM/YYYY
  const dmyRegex = /(?:^|[^0-9])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:$|[^0-9])/;
  const dmyMatch = cleanText.match(dmyRegex);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. Match DD-MM or DD/MM (without year, fallback to current year)
  const dmRegex = /(?:^|[^0-9])(\d{1,2})[-/.](\d{1,2})(?:$|[^0-9])/;
  const dmMatch = cleanText.match(dmRegex);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10);
    const year = new Date().getFullYear();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // Ensure we don't accidentally match something like 15-05 in "Case 15-05" unless it's likely a date
      // We can check if the surrounding context contains calendar words
      const dateIndicatorKeywords = ['جلسة', 'تاريخ', 'يوم', 'جلسه', 'شهر', 'عام'];
      const hasIndicator = dateIndicatorKeywords.some(kw => text.includes(kw));
      if (hasIndicator) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

/**
 * Checks if a file name or category suggests it relates to a court hearing session.
 */
export function checkIfRelatesToHearing(fileName: string, fileCategory: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  
  // Keywords indicating hearing
  const hearingKeywords = [
    'جلسة', 'جلسه', 'حضور', 'رول', 'محضر', 'مرافعة', 
    'مرافعه', 'مذكرة', 'مذكره', 'دفاع', 'حكم', 'قرار', 'تأجيل', 'أجندة', 'اجندة'
  ];
  
  const hasKeyword = hearingKeywords.some(kw => lowerFileName.includes(kw));
  const isHearingCategory = ['صحف الدعاوى', 'مذكرات', 'أحكام'].includes(fileCategory);
  
  return hasKeyword || isHearingCategory;
}

/**
 * Generates a pre-filled suggestion for a hearing session based on the file metadata.
 */
export function suggestHearingSession(
  fileName: string, 
  fileCategory: string, 
  currentCase: Case
): {
  isSuggested: boolean;
  session: Omit<HearingSession, 'id'>;
} {
  const isSuggested = checkIfRelatesToHearing(fileName, fileCategory);
  const today = new Date();
  const localDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const detectedDate = extractHearingDate(fileName) || currentCase.nextHearingDate || localDateStr;
  
  // Build a nice subject
  let subject = '';
  if (fileCategory === 'أحكام') {
    subject = `جلسة النطق بالحكم / استلام منطوق الحكم: ${fileName}`;
  } else if (fileCategory === 'مذكرات') {
    subject = `جلسة تقديم مذكرة الدفاع: ${fileName}`;
  } else if (fileCategory === 'صحف الدعاوى') {
    subject = `جلسة تقديم صحيفة الدعوى / إعلان العريضة: ${fileName}`;
  } else {
    subject = `جلسة متابعة مستندات: ${fileName}`;
  }

  return {
    isSuggested,
    session: {
      caseId: currentCase.id,
      caseNumber: currentCase.caseNumberFirstInstance,
      caseYear: currentCase.caseYearFirstInstance,
      clientName: currentCase.clientName,
      opponentName: currentCase.opponent.name,
      court: currentCase.court,
      circuit: currentCase.circuit,
      type: currentCase.type,
      date: detectedDate,
      time: '09:00',
      subject: subject,
      status: 'pending',
      assignedLawyerId: currentCase.assignedLawyerId,
      notes: `تمت جدولة هذه الجلسة تلقائياً ومزامنتها بناءً على إرفاق ملف: ${fileName} المصنف كـ (${fileCategory})`
    }
  };
}
