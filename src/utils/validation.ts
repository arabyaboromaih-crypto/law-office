import { toEn } from './arabicNumbers';

/**
 * Unifies the National ID validation logic across the app.
 * - Trims leading and trailing spaces from the value.
 * - Converts Arabic-Indic numerals (٠-٩) to standard digits (0-9).
 * - If the value is empty and not required, it is considered valid.
 * - If a value is provided, it must be exactly 14 digits, containing only 0-9 with no characters, spaces, or symbols.
 */
export function validateNationalId(
  val: string | null | undefined,
  isRequired = false
): { isValid: boolean; normalizedValue: string } {
  if (val === undefined || val === null) {
    return { isValid: !isRequired, normalizedValue: '' };
  }

  // Trim leading and trailing spaces
  const trimmed = val.trim();

  // Convert Arabic-Indic digits to English digits
  const normalized = toEn(trimmed);

  if (normalized === '') {
    return { isValid: !isRequired, normalizedValue: '' };
  }

  // Match exactly 14 digits (0-9) with no other characters, spaces, or symbols
  const isValid = /^[0-9]{14}$/.test(normalized);

  return { isValid, normalizedValue: normalized };
}
