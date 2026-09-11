/**
 * Utility to convert Latin digits (0-9) to Eastern Arabic digits (٠-٩)
 * Checks the chosen numbering system in localStorage.
 */
export function toAr(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  const system = localStorage.getItem('romeih_numbering_system') || 'arabic';
  if (system === 'english') {
    return str;
  }
  return str.replace(/[0-9]/g, (char) => '٠١٢٣٤٥٦٧٨٩'[char.charCodeAt(0) - 48]);
}

/**
 * Utility to convert Eastern Arabic digits (٠-٩) to Latin digits (0-9)
 */
export function toEn(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  return str.replace(/[٠-٩]/g, (char) => String(char.charCodeAt(0) - 1632));
}

/**
 * Normalizes input: converts any Eastern Arabic digits to Latin digits,
 * and removes any remaining non-digit characters.
 */
export function cleanDigits(val: string | number | undefined | null): string {
  return toEn(val).replace(/\D/g, '');
}
