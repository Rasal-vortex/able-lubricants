import { ApiClientError } from '../services/api';

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface CouponFieldErrors {
  code?: string;
  price?: string;
  form?: string;
}

export function getCouponFieldErrors(error: unknown): CouponFieldErrors {
  const rawMessage = error instanceof Error ? error.message : 'The coupon could not be saved.';
  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes('already exists') ||
    normalized.includes('already been recorded') ||
    normalized.includes('unique constraint') ||
    normalized.includes('p2002')
  ) {
    return { code: 'This coupon code is already in use.' };
  }

  if (error instanceof ApiClientError && error.fieldErrors.length > 0) {
    const result: CouponFieldErrors = {};
    for (const fieldError of error.fieldErrors) {
      if (fieldError.field === 'code') result.code = fieldError.message;
      else if (fieldError.field === 'price') result.price = fieldError.message;
      else result.form = fieldError.message;
    }
    if (result.code || result.price || result.form) return result;
  }

  return { form: rawMessage };
}

export function getSaleCouponErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'The sale could not be saved.';
  const normalized = message.toLowerCase();
  if (normalized.includes('already exists') || normalized.includes('already been recorded') || normalized.includes('unique constraint')) {
    return 'This coupon code has already been recorded or redeemed. Use a different, unrecorded code.';
  }
  if (normalized.includes('coupon discount cannot exceed') || normalized.includes('invoice discount cannot exceed')) {
    return 'The coupon discount cannot be greater than the remaining sale value.';
  }
  if (normalized.includes('couponcode') && normalized.includes('couponprice')) {
    return 'Enter both the coupon code and its amount, or leave both blank.';
  }
  return message;
}
