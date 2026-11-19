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

export interface DashboardSummary {
  today: { date: string; salesTotal: string; expensesTotal: string; paymentsCollected: string };
  balances: { customerOutstanding: string; supplierPayable: string };
  currentMonth: { month: string; salesCount: number };
  chart: { month: string; days: Array<{ date: string; paidSales: string; creditSales: string }> };
  latestSales: Array<{
    invoiceNumber: string;
    customerName: string;
    paymentMethod: string;
    total: string;
    date: string;
  }>;
}

export interface ApiExpense {
  id: string;
  description: string;
  category: string;
  amount: string | number;
  expenseDate: string;
  paymentMethod?: string | null;
  notes?: string | null;
}

export interface ExpensePayload {
  description?: string;
  category: string;
  amount: number;
  expenseDate?: string;
  paymentMethod?: 'CASH' | 'UPI' | null;
  notes?: string | null;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
  error?: string;
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly fieldErrors: Array<{ field?: string; message?: string }> = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const API_BASE_URL = import.meta.env.API_BASE_URL.replace(/\/$/, '');

export const AUTH_SESSION_KEY = 'able_lubes_auth_session_v1';
export const AUTH_SESSION_REFRESHED_EVENT = 'able-lubes:auth-session-refreshed';
export const AUTH_SESSION_EXPIRED_EVENT = 'able-lubes:auth-session-expired';

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<{ token: string; user: AuthUser }>;
    if (response.status === 401) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
      return null;
    }
    if (!response.ok || !body.data?.token || !body.data.user) {
      throw new ApiClientError(body.message || body.error || 'Could not refresh the sign-in session.', response.status);
    }
    const session = { token: body.data.token, user: body.data.user };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_REFRESHED_EVENT, { detail: session }));
    return session.token;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function requestEnvelope<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  allowRefresh = true,
): Promise<ApiEnvelope<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: options.credentials ?? 'include',
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (!response.ok) {
      if (response.status === 401 && token && allowRefresh && !path.startsWith('/auth/')) {
        const renewedToken = await refreshAccessToken();
        if (renewedToken) return requestEnvelope<T>(path, options, renewedToken, false);
      }
      throw new ApiClientError(
        body.message || body.error || `Request failed (${response.status})`,
        response.status,
        body.errors || [],
      );
    }
    if (response.status === 204) {
      return body;
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
  if (response.data === undefined) return undefined as T;
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
  purchaseRate: number;
  sellingPrice: number;
  mrp?: number | null;
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
  symbol?: string | null;
  active?: boolean;
  allowsDecimals: boolean;
}

export interface ApiProduct {
  id: string;
  name: string;
  brandId?: string;
  unitId: string;
  purchaseRate: string | number;
  sellingPrice: string | number;
  mrp: string | number | null;
  sku?: string;
  currentStock: string | number;
  brand?: string | ApiBrand;
  unit?: string | ApiUnit;
  brandName?: string;
  unitName: string;
  unitSymbol: string | null;
  unitAllowsDecimals: boolean;
  active?: boolean;
  batches?: Array<{
    id: string;
    label?: string | null;
    sellingRate: string | number;
    remainingQuantity: string | number;
    receivedAt: string;
    source: 'PURCHASE' | 'OPENING' | 'ADJUSTMENT';
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSalePayload {
  customerId?: string;
  creditBill?: { billNumber: string; dueDate: string; term: string; priorBalance: number };
  discountAmount?: number;
  couponCode?: string;
  couponPrice?: number;
  items: Array<{
    productId: string;
    inventoryBatchId: string;
    quantity: number;
    unitSellingPrice?: number;
    displayQuantity?: number;
    displayUnitName?: string;
    displayUnitSymbol?: string;
    discountAmount: number;
  }>;
}

export interface ApiSale {
  id: string;
  invoiceNumber?: string;
  customerId?: string;
  totalAmount: string | number;
  discountAmount?: string | number;
  status?: string;
  items?: Array<{
    id: string;
    productId: string;
    inventoryBatchId?: string | null;
    quantity: string | number;
    displayQuantity?: string | number | null;
    displayUnitName?: string | null;
    displayUnitSymbol?: string | null;
    sellingPrice: string | number;
    historicalCostSnapshot?: string | number | null;
    batchSellingPriceSnapshot?: string | number | null;
    costSnapshotSource?: 'VERIFIED_BATCH' | 'LEGACY_ESTIMATE' | null;
    discountAmount: string | number;
    totalAmount: string | number;
  }>;
  createdAt?: string;
}

export interface ApiCreditBill {
  id: string;
  saleId?: string | null;
  customerId: string;
  partyName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  term: string;
  status: 'Overdue' | 'Partially Paid' | 'Unpaid' | 'Settled';
  priorBalance: string | number;
  billAmount: string | number;
  paidAmount: string | number;
  netDue: string | number;
  remarks?: string | null;
  payments: Array<{ id: string; amount: string | number; method: string; date: string }>;
}

export interface CreateCreditBillPayload {
  customerId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  term: string;
  billAmount: number;
  priorBalance: number;
  remarks?: string;
}

export interface ApiCoupon {
  id: string;
  code: string;
  price: string | number;
  isSaleBased: boolean;
  saleId?: string | null;
  sale?: { id: string; invoiceNumber: string } | null;
  createdAt?: string;
  updatedAt?: string;
  redeemedAmount?: string | number;
  remainingAmount?: string | number | null;
  redemptions?: ApiCouponRedemption[];
}

export interface ApiCouponRedemption {
  id: string;
  code: string;
  amount: string | number;
  paymentDate: string;
  saleId?: string | null;
  isSaleBased?: boolean;
  billNumber: string;
  customerName: string;
}

export interface CouponPayload {
  code: string;
  price: number;
}

export type CouponFilter = 'all' | 'sales-based' | 'non-sale-based';

export interface ApiPage<T> {
  data: T[];
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

export interface CreatePurchasePayload {
  idempotencyKey: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  discountAmount: number;
  items: Array<{
    productId: string;
    quantity: number;
    supplierRate: number;
    sellingRate: number;
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
    inventoryBatch?: {
      id: string;
      label?: string | null;
      purchaseRate: string | number;
      sellingRate: string | number;
      receivedQuantity: string | number;
      remainingQuantity: string | number;
      receivedAt: string;
      source: 'PURCHASE' | 'OPENING' | 'ADJUSTMENT';
    } | null;
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
export type CustomerTenderMethod = 'CASH' | 'UPI' | 'COUPON';

export interface CustomerPaymentPayload {
  customerId?: string;
  saleId: string;
  amount: number;
  method: CustomerTenderMethod;
  notes?: string;
  paymentDate?: string;
}

export const createCustomerPaymentRequest = (token: string, payload: CustomerPaymentPayload) =>
  apiRequest('/customer-payments', { method: 'POST', body: JSON.stringify(payload) }, token);

export const getDailySalesReport = (token: string, date: string) =>
  apiRequest<any>(`/reports/daily-sales?date=${encodeURIComponent(date)}`, {}, token);

export const getProfitReport = (token: string, from: string, to: string) => {
  const query = new URLSearchParams({ from, to });
  return apiRequest<any>(`/reports/profit?${query.toString()}`, {}, token);
};

export const getSalesReport = (token: string, from: string, to: string) => {
  const query = new URLSearchParams({ from, to });
  return apiRequest<any>(`/reports/sales?${query.toString()}`, {}, token);
};

export const getExpenseReport = (token: string, from: string, to: string) => {
  const query = new URLSearchParams({ from, to });
  return apiRequest<any>(`/reports/expenses?${query.toString()}`, {}, token);
};

export const getSupplierOutstandingReport = (token: string) =>
  apiRequest<any[]>('/reports/suppliers/outstanding', {}, token);

export const getSupplierLedgerReport = (token: string, supplierId: string) =>
  apiRequest<any>(`/reports/suppliers/${encodeURIComponent(supplierId)}/ledger`, {}, token);

export type StockAdjustmentPayload =
  | {
      productId: string;
      quantity: number;
      direction: 'IN';
      purchaseRate: number;
      sellingRate: number;
      reason?: string;
      notes?: string;
    }
  | {
      productId: string;
      quantity: number;
      direction: 'OUT';
      inventoryBatchId: string;
      reason?: string;
      notes?: string;
    };

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
export const getDashboardSummary = (token: string, month: string) =>
  apiRequest<DashboardSummary>(`/dashboard/summary?month=${encodeURIComponent(month)}`, {}, token);

export async function getExpensesRequest(token: string, from?: string, to?: string): Promise<ApiExpense[]> {
  const all: ApiExpense[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ page: String(page), limit: '100' });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const response = await requestEnvelope<ApiExpense[]>(`/expenses?${query.toString()}`, {}, token);
    all.push(...(response.data || []));
    totalPages = response.meta?.totalPages ?? page;
    page += 1;
  } while (page <= totalPages && page <= 100);
  return all;
}

export const createExpenseRequest = (token: string, payload: ExpensePayload) =>
  apiRequest<ApiExpense>('/expenses', { method: 'POST', body: JSON.stringify(payload) }, token);

export const updateExpenseRequest = (token: string, id: string, payload: Partial<ExpensePayload>) =>
  apiRequest<ApiExpense>(`/expenses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);

export const createBrandRequest = (token: string, name: string) =>
  apiRequest<ApiBrand>('/brands', { method: 'POST', body: JSON.stringify({ name, active: true }) }, token);

export const createUnitRequest = (token: string, payload: { name: string; symbol: string | null; allowsDecimals: boolean }) =>
  apiRequest<ApiUnit>('/units', { method: 'POST', body: JSON.stringify({ ...payload, active: true }) }, token);

export const updateUnitRequest = (token: string, id: string, payload: Partial<{ name: string; symbol: string | null; allowsDecimals: boolean }>) =>
  apiRequest<ApiUnit>(`/units/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);

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

export const getCustomerCreditBillsRequest = (token: string) =>
  apiRequest<ApiCreditBill[]>('/credit-bills', {}, token);

export const createCustomerCreditBillRequest = (token: string, payload: CreateCreditBillPayload) =>
  apiRequest<ApiCreditBill>('/credit-bills', { method: 'POST', body: JSON.stringify(payload) }, token);

export const recordManualCreditBillPaymentRequest = (token: string, id: string, payload: { amount: number; paymentDate?: string; method: 'CASH' | 'UPI' }) =>
  apiRequest<ApiCreditBill>(`/credit-bills/${encodeURIComponent(id)}/payments`, { method: 'POST', body: JSON.stringify(payload) }, token);

export const getCouponsRequest = async (
  token: string,
  type: CouponFilter,
  page = 1,
  limit = 100,
): Promise<ApiPage<ApiCoupon>> => {
  const query = new URLSearchParams({ type, page: String(page), limit: String(limit) });
  const response = await requestEnvelope<ApiCoupon[]>(`/coupons?${query.toString()}`, {}, token);
  return { data: response.data || [], meta: response.meta };
};

export async function getAllCouponsRequest(token: string, type: CouponFilter): Promise<ApiCoupon[]> {
  const coupons: ApiCoupon[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await getCouponsRequest(token, type, page);
    coupons.push(...result.data);
    totalPages = result.meta?.totalPages ?? page;
    page += 1;
  } while (page <= totalPages && page <= 100);
  return coupons;
}

export const getCouponRequest = (token: string, id: string) =>
  apiRequest<ApiCoupon>(`/coupons/${encodeURIComponent(id)}`, {}, token);

export const getCouponRedemptionsRequest = (token: string) =>
  apiRequest<ApiCouponRedemption[]>('/coupons/redemptions', {}, token);

export const createCouponRequest = (token: string, payload: CouponPayload) =>
  apiRequest<ApiCoupon>('/coupons', {
    method: 'POST',
    body: JSON.stringify({ ...payload, code: payload.code.trim().toUpperCase() }),
  }, token);

export const updateCouponRequest = (token: string, id: string, payload: Partial<CouponPayload>) =>
  apiRequest<ApiCoupon>(`/coupons/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...payload,
      ...(payload.code !== undefined ? { code: payload.code.trim().toUpperCase() } : {}),
    }),
  }, token);

export const deleteCouponRequest = (token: string, id: string) =>
  apiRequest<void>(`/coupons/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);

export const createPurchaseRequest = (token: string, payload: CreatePurchasePayload) =>
  apiRequest<ApiPurchase>('/purchases', { method: 'POST', body: JSON.stringify(payload) }, token);

export const cancelPurchaseRequest = (token: string, purchaseId: string) =>
  apiRequest<ApiPurchaseCancellation>(`/purchases/${encodeURIComponent(purchaseId)}/cancel`, { method: 'POST' }, token);

export const createSupplierPaymentRequest = (
  token: string,
  payload: {
    supplierId: string;
    purchaseId: string;
    paymentDate?: string;
    notes?: string;
    receiptNumber?: string;
    amount?: number;
    method?: PaymentMethod;
    tenders?: Array<{ method: 'CASH' | 'UPI'; amount: number }>;
  },
) => apiRequest('/supplier-payments', { method: 'POST', body: JSON.stringify(payload) }, token);


export function loginRequest(email: string, password: string) {
  return apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export const logoutRequest = () =>
  apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' });
