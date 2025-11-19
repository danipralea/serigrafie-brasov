/**
 * Application-wide constants
 */

// File Upload Constraints
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = 10;

// Time Constants
export const INVITATION_EXPIRY_DAYS = 7;
export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// Order Limits
export const MAX_SUB_ORDERS = 10;

// Validation
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Debounce Delays (ms)
export const SEARCH_DEBOUNCE_MS = 300;
export const INPUT_DEBOUNCE_MS = 500;

// Firebase Limits
export const FIRESTORE_IN_QUERY_LIMIT = 10;

// Date Formats
export const DATE_FORMAT_DISPLAY = 'DD.MM.YYYY';
export const DATETIME_FORMAT_DISPLAY = 'DD.MM.YYYY HH:mm';
export const DATE_FORMAT_ISO = 'YYYY-MM-DD';
