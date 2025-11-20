function normalizeDateInput(input: any): Date | null {
  if (!input) return null;

  // Firestore Timestamp (emulator/prod)
  if (typeof input.toDate === 'function') {
    return input.toDate();
  }

  // Firestore Timestamp-like object { seconds, nanoseconds }
  if (typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }

  // ISO string or number (ms timestamp)
  if (typeof input === 'string' || typeof input === 'number') {
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Already a Date instance
  if (input instanceof Date) {
    return input;
  }

  return null;
}

/**
 * Format a date with dot separators in DD.MM.YYYY format
 * @param date - Date object, Firestore Timestamp, ISO string, or millis
 * @returns Formatted date string with dots (e.g., "13.11.2025")
 */
export function formatDate(date: any): string {
  const dateObj = normalizeDateInput(date);
  if (!dateObj) return '';

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * Format a date with month name (e.g., "November 2025")
 * @param date - Date object
 * @param locale - Locale string (default: 'ro-RO')
 * @returns Formatted date string with month name
 */
export function formatMonthYear(date: Date, locale: string = 'ro-RO'): string {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}
