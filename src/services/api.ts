export type UserRole = 'ADMIN' | 'STAFF';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

interface ApiEnvelope<T> {
  data?: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
  error?: string;
}

const API_BASE_URL = import.meta.env.API_BASE_URL.replace(/\/$/, '');

export const AUTH_SESSION_KEY = 'able_lubes_auth_session_v1';

async function requestEnvelope<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (!response.ok) {
      throw new Error(body.error || `Request failed (${response.status})`);
    }
    if (body.data === undefined) {
      throw new Error('The API returned an unexpected response.');
    }
    return body;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The API did not respond within 10 seconds. Check that the backend is running and reachable.');
    }
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach the API at ${API_BASE_URL}. Check the backend address, server status, and network access.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await requestEnvelope<T>(path, options, token);
  return response.data as T;
}

export async function apiRequestPage<T>(path: string, token: string, page: number, limit = 100) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await requestEnvelope<T[]>(`${path}?${query.toString()}`, {}, token);
  return { data: response.data as T[], meta: response.meta };
}

export async function getAllPages<T>(path: string, token: string): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await apiRequestPage<T>(path, token, page);
    all.push(...result.data);
    totalPages = result.meta?.totalPages ?? page;
    page += 1;
  } while (page <= totalPages && page <= 100);
  return all;
}

export interface ProductPayload {
  name: string;
  brandId: string;
  unitId: string;
  sellingPrice: number;
  mrp: number;
  active?: boolean;
}

export interface CreateProductPayload extends ProductPayload {
  qty?: number;
}

export interface ApiBrand {
  id: string;
  name: string;
  active?: boolean;
}

export interface ApiUnit {
  id: string;
  name: string;
  symbol?: string;
  active?: boolean;
}

export interface ApiProduct {
  id: string;
  name: string;
  brandId?: string;
  unitId?: string;
  sellingPrice: string | number;
  mrp: string | number;
  sku?: string;
  currentStock: string | number;
  brand?: string | ApiBrand;
  unit?: string | ApiUnit;
  brandName?: string;
  unitName?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSalePayload {
  customerId?: string;
  discountAmount?: number;
  items: Array<{
    productId: string;
    quantity: number;
    discountAmount: number;
  }>;
}

export interface ApiSale {
  id: string;
  customerId?: string;
  totalAmount: string | number;
  discountAmount?: string | number;
  status?: string;
  items?: Array<{
    id: string;
    productId: string;
    quantity: string | number;
    sellingPrice: string | number;
    discountAmount: string | number;
    totalAmount: string | number;
  }>;
  createdAt?: string;
}

export interface CreatePurchasePayload {
  supplierId: string;
  supplierInvoiceNumber: string;
  discountAmount: number;
  items: Array<{
    productId: string;
    quantity: number;
    supplierRate: number;
  }>;
}

export interface ApiPurchase {
  id: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  totalAmount: string | number;
  discountAmount?: string | number;
  status?: string;
  items?: Array<{
    id: string;
    productId: string;
    quantity: string | number;
    supplierRate: string | number;
    totalAmount: string | number;
  }>;
  createdAt?: string;
}

export interface ApiPurchaseCancellation {
  id: string;
  status: string;
  updatedAt?: string;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

export interface StockAdjustmentPayload {
  productId: string;
  quantity: number;
  direction: 'IN' | 'OUT';
  reason: string;
  notes?: string;
}

export interface ApiStockAdjustment {
  id: string;
  productId: string;
  quantity: string | number;
  direction: 'IN' | 'OUT';
  stockAfter: string | number;
  reason: string;
  createdAt?: string;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  address: string;
  active?: boolean;
}

export interface ApiCustomer extends CustomerPayload {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SupplierPayload = CustomerPayload;

export interface ApiSupplier extends SupplierPayload {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export const getProducts = (token: string) => getAllPages<ApiProduct>('/products', token);
export const getProductRequest = (token: string, id: string) =>
  apiRequest<ApiProduct>(`/products/${encodeURIComponent(id)}`, {}, token);
export const getBrands = (token: string) => getAllPages<ApiBrand>('/brands', token);
export const getUnits = (token: string) => getAllPages<ApiUnit>('/units', token);

export const createBrandRequest = (token: string, name: string) =>
  apiRequest<ApiBrand>('/brands', { method: 'POST', body: JSON.stringify({ name, active: true }) }, token);

export const createUnitRequest = (token: string, name: string, symbol: string) =>
  apiRequest<ApiUnit>('/units', { method: 'POST', body: JSON.stringify({ name, symbol, active: true }) }, token);

export const getCustomers = (token: string) => getAllPages<ApiCustomer>('/customers', token);

export const createCustomerRequest = (token: string, payload: CustomerPayload) =>
  apiRequest<ApiCustomer>('/customers', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateCustomerRequest = (token: string, id: string, payload: Partial<CustomerPayload>) =>
  apiRequest<ApiCustomer>(`/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);

export const getSuppliers = (token: string) => getAllPages<ApiSupplier>('/suppliers', token);

export const createSupplierRequest = (token: string, payload: SupplierPayload) =>
  apiRequest<ApiSupplier>('/suppliers', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateSupplierRequest = (token: string, id: string, payload: Partial<SupplierPayload>) =>
  apiRequest<ApiSupplier>(`/suppliers/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);

export const createProductRequest = (token: string, payload: CreateProductPayload) =>
  apiRequest<ApiProduct>('/products', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateProductRequest = (token: string, id: string, payload: Partial<ProductPayload>) =>
  apiRequest<ApiProduct>(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);

export const createStockAdjustmentRequest = (token: string, payload: StockAdjustmentPayload) =>
  apiRequest<ApiStockAdjustment>('/stock-adjustments', { method: 'POST', body: JSON.stringify(payload) }, token);

export const createSaleRequest = (token: string, payload: CreateSalePayload) =>
  apiRequest<ApiSale>('/sales', { method: 'POST', body: JSON.stringify(payload) }, token);

export const createPurchaseRequest = (token: string, payload: CreatePurchasePayload) =>
  apiRequest<ApiPurchase>('/purchases', { method: 'POST', body: JSON.stringify(payload) }, token);

export const cancelPurchaseRequest = (token: string, purchaseId: string) =>
  apiRequest<ApiPurchaseCancellation>(`/purchases/${encodeURIComponent(purchaseId)}/cancel`, { method: 'POST' }, token);

export const createSupplierPaymentRequest = (
  token: string,
  payload: { supplierId: string; purchaseId: string; amount: number; method: PaymentMethod; notes?: string },
) => apiRequest('/supplier-payments', { method: 'POST', body: JSON.stringify(payload) }, token);


export function loginRequest(email: string, password: string) {
  return apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
