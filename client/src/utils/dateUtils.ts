/**
 * Format a date with dot separators in DD.MM.YYYY format
 * @param date - Date object or Firestore Timestamp
 * @returns Formatted date string with dots (e.g., "13.11.2025")
 */
export function formatDate(date: Date | { toDate: () => Date } | undefined | null): string {
  if (!date) return '';

  const dateObj = date instanceof Date ? date : date.toDate();

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
