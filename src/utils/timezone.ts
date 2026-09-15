/**
 * Utility functions to manage date and time specifically in the Egypt/Cairo timezone (Africa/Cairo).
 */

/**
 * Returns a string in 'YYYY-MM-DD' format for Egypt/Cairo timezone.
 */
export function getEgyptYYYYMMDD(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || String(date.getFullYear());
    const month = parts.find(p => p.type === 'month')?.value || String(date.getMonth() + 1).padStart(2, '0');
    const day = parts.find(p => p.type === 'day')?.value || String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback if Intl or Africa/Cairo timezone is not supported
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Formats a date using ar-EG locale in Egypt/Cairo timezone.
 */
export function formatEgyptDate(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  const system = localStorage.getItem('romeih_numbering_system') || 'arabic';
  const numberingSystem = system === 'english' ? 'latn' : 'arab';
  return date.toLocaleDateString('ar-EG', {
    timeZone: 'Africa/Cairo',
    ...options,
    numberingSystem
  });
}

/**
 * Formats a time using ar-EG locale in Egypt/Cairo timezone.
 */
export function formatEgyptTime(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  const system = localStorage.getItem('romeih_numbering_system') || 'arabic';
  const numberingSystem = system === 'english' ? 'latn' : 'arab';
  return date.toLocaleTimeString('ar-EG', {
    timeZone: 'Africa/Cairo',
    ...options,
    numberingSystem
  });
}
