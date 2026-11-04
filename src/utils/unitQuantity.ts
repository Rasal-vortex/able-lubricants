export const QUANTITY_SCALE = 3;

export function isUnitQuantityValid(value: number, allowsDecimals: boolean): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  if (!allowsDecimals) return Number.isInteger(value);
  return Math.abs(value * 10 ** QUANTITY_SCALE - Math.round(value * 10 ** QUANTITY_SCALE)) < 1e-7;
}

export function isUnitQuantityInputValid(value: string, allowsDecimals: boolean): boolean {
  if (!value) return true;
  return allowsDecimals
    ? /^\d+(?:\.\d{0,3})?$/.test(value)
    : /^\d+$/.test(value);
}

export function quantityStep(allowsDecimals: boolean): string {
  return allowsDecimals ? '0.001' : '1';
}
