export type NavScreen =
  | 'dashboard'
  | 'product-entry'
  | 'sales-bill-entry'
  | 'credit-bill-management'
  | 'coupons'
  | 'daily-sales-management'
  | 'purchase-bill-entry'
  | 'party-ledger-management'
  | 'reports-and-profit-calculation';

export interface InventoryBatchOption {
  id: string;
  label?: string | null;
  purchaseRate: number;
  sellingRate: number;
  mrp: number | null;
  isDefaultSellingRate: boolean;
  receivedQuantity: number;
  remainingQuantity: number;
  receivedAt: string;
  source: 'PURCHASE' | 'OPENING' | 'ADJUSTMENT';
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  brandId?: string;
  unitId: string;
  unitAllowsDecimals: boolean;
  hsn: string;
  brand: string;
  unit: string;
  unitName?: string;
  sellingPrice: number;
  purchaseRate: number;
  mrp: number;
  quantity: number;
  batches: InventoryBatchOption[];
  status: 'Active' | 'Inactive';
  minThreshold?: number;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
  address?: string;
  active?: boolean;
  availableStoreCredit?: number;
}

export interface SaleLineItem {
  saleItemId?: string;
  productId: string;
  inventoryBatchId?: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  returnedQuantity?: number;
  displayQuantity?: number;
  displayUnitName?: string;
  displayUnitSymbol?: string;
  lineTotal?: number;
  sellingPrice: number;
  purchaseRate: number;
  tax: number;
}

export interface CartItem {
  id: string;
  productId?: string;
  inventoryBatchId?: string;
  name: string;
  sku: string;
  tax: number;
  quantity: number;
  price: number;
}

export interface SaleRecord {
  id: string;
  saleId?: string;
  returnStatus?: 'NONE' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED';
  billNumber: string;
  dateTime: string;
  customerName: string;
  customerType: 'walkin' | 'registered';
  customerPhone?: string;
  itemsCount: number;
  itemsList: string;
  paymentMode: 'Cash' | 'Credit' | 'UPI' | 'Coupon' | 'Split';
  paymentTenders?: Array<{ method: 'CASH' | 'UPI' | 'COUPON' | 'STORE_CREDIT' | 'CREDIT'; amount: number; notes?: string }>;
  idempotencyKey?: string;
  upiRef?: string;
  amount: number;
  netSalesAmount?: number;
  subtotal: number;
  billTotal?: number;
  couponCode?: string;
  couponPrice?: number;
  discountAmount?: number;
  billDiscountAmount?: number;
  cashReceived?: number;
  changeGiven?: number;
  partyLedgerId?: string;
  creditDueDate?: string;
  date?: string;
  lineItems?: SaleLineItem[];
  costOfGoodsSold?: number;
}

export interface CreditBill {
  id: string;
  saleId?: string | null;
  customerId?: string;
  paidAmount?: number;
  billDate: string;
  billNumber: string;
  partyName: string;
  gstin: string;
  term: string;
  status: 'Overdue' | 'Partially Paid' | 'Unpaid' | 'Settled' | 'Cancelled';
  overdueDays?: number;
  priorBalance: number;
  billAmount: number;
  netDue: number;
  dueDate: string;
  remarks?: string;
  invoiceReference?: string;
  saleItems?: Array<{ productName: string; quantity: number; unitName: string; unitSymbol?: string | null }>;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledByName?: string;
  actualReceivedAmount?: number;
  paymentCorrections?: Array<{ id: string; type: 'REVERSAL' | 'ACTUAL_RECEIPT'; amount: number; method: string; reason: string; createdAt: string; originalPaymentId?: string | null }>;
  refundPayable?: number;
  refunds?: Array<{ id: string; amount: number; method: string; reference?: string | null; date: string; createdByName?: string | null; originalPaymentId?: string | null }>;
  payments?: Array<{ id: string; amount: number; method: string; date: string }>;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  receiptUrl?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface PurchaseLineItem {
  id: string;
  productId?: string;
  name: string;
  unit?: string;
  quantity: number;
  sellingPrice: number;
  purchaseRate: number;
  mrp: number | null;
  totalAmount: number;
}

export interface PurchaseBill {
  id: string;
  status?: string;
  invoiceNumber: string;
  partyName: string;
  invoiceDate: string;
  items: PurchaseLineItem[];
  subtotal: number;
  taxShipping: number;
  totalAmount: number;
  remarks?: string;
  amountPaid?: number;
  supplierCreditApplied?: number;
  outstandingBalance?: number;
  cancellation?: {
    reason: string;
    cancelledAt: string;
    refund?: {
      amount: number;
      settled: number;
      pending: number;
      status: 'NO_REFUND_REQUIRED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';
    };
  };
}

export interface PartyLedgerEntry {
  id: string;
  partyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  billAmount: number;
  paymentDate: string;
  amountPaid: number;
  outstandingBalance: number;
  transactionType: 'INVOICES' | 'PAYMENTS' | 'CANCELLATIONS';
  paymentMode?: string;
  partyType: 'customer' | 'supplier';
}

