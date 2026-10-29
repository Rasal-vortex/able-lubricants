export type NavScreen =
  | 'dashboard'
  | 'product-entry'
  | 'sales-bill-entry'
  | 'credit-bill-management'
  | 'daily-sales-management'
  | 'expense-management'
  | 'purchase-bill-entry'
  | 'party-ledger-management'
  | 'reports-and-profit-calculation';

export interface Product {
  id: string;
  name: string;
  sku: string;
  brandId?: string;
  unitId?: string;
  hsn: string;
  brand: string;
  unit: string;
  sellingPrice: number;
  purchaseRate: number;
  mrp: number;
  quantity: number;
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
}

export interface SaleLineItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  sellingPrice: number;
  purchaseRate: number;
  discount: number;
  tax: number;
}

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  tax: number;
  quantity: number;
  price: number;
  discount: number; // percentage
}

export interface SaleRecord {
  id: string;
  billNumber: string;
  dateTime: string;
  customerName: string;
  customerType: 'walkin' | 'registered';
  customerPhone?: string;
  itemsCount: number;
  itemsList: string;
  paymentMode: 'Cash' | 'Credit' | 'UPI';
  upiRef?: string;
  amount: number;
  subtotal: number;
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
  billDate: string;
  billNumber: string;
  partyName: string;
  gstin: string;
  term: string;
  status: 'Overdue' | 'Partially Paid' | 'Unpaid' | 'Settled';
  overdueDays?: number;
  priorBalance: number;
  billAmount: number;
  netDue: number;
  dueDate: string;
  remarks?: string;
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
  outstandingBalance?: number;
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
  transactionType: 'INVOICES' | 'PAYMENTS';
  paymentMode?: string;
  partyType: 'customer' | 'supplier';
}

