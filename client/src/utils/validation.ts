/**
 * Validation utilities for form inputs and data
 */

import { EMAIL_REGEX, PHONE_REGEX, MAX_FILE_SIZE_BYTES } from '../constants';

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates phone number format
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  return PHONE_REGEX.test(phone.trim());
}

/**
 * Validates file size
 */
export function isValidFileSize(file: File, maxSizeBytes: number = MAX_FILE_SIZE_BYTES): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Validates file type against allowed types
 */
export function isValidFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Sanitizes string input by trimming and removing dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validates required field
 */
export function isRequired(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return value.toString().trim().length > 0;
}

/**
 * Validates minimum length
 */
export function minLength(value: string, min: number): boolean {
  if (!value) {
    return false;
  }
  return value.trim().length >= min;
}

/**
 * Validates maximum length
 */
export function maxLength(value: string, max: number): boolean {
  if (!value) {
    return true;
  }
  return value.trim().length <= max;
}

/**
 * Validates if value is a positive number
 */
export function isPositiveNumber(value: number | string): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
}

/**
 * Comprehensive validation for email with error message
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!isRequired(email)) {
    return { valid: false, error: 'Email is required' };
  }
  if (!isValidEmail(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * Comprehensive validation for phone with error message
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!isRequired(phone)) {
    return { valid: false, error: 'Phone number is required' };
  }
  if (!isValidPhone(phone)) {
    return { valid: false, error: 'Invalid phone number format' };
  }
  return { valid: true };
}
