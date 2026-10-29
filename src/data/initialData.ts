import { CreditBill, Expense, PartyLedgerEntry, PurchaseBill, SaleRecord } from '../types';

// Demo records for sections that have not yet been connected to the API.
const dateOffset = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dateLabel = (daysAgo: number) => new Date(`${dateOffset(daysAgo)}T12:00:00`).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
});

export const INITIAL_SALES: SaleRecord[] = [
  {
    id: 'sale-1', billNumber: 'SB-2104', date: dateOffset(0), dateTime: `${dateLabel(0)}, 10:15`, customerName: 'Northside Auto Service', customerType: 'registered', customerPhone: '+1 555-0101', itemsCount: 2, itemsList: 'Engine Oil 5W-30 Synthetic (x4), Brake Fluid DOT 4 (x2)', paymentMode: 'UPI', upiRef: 'UPI-2104', amount: 71, subtotal: 71, discountAmount: 0, costOfGoodsSold: 44.4,
    lineItems: [
      { productId: 'prod-1', name: 'Engine Oil 5W-30 Synthetic', sku: 'AL-EO-530', unit: '1 L bottle', quantity: 4, sellingPrice: 14.5, purchaseRate: 9.2, discount: 0, tax: 0 },
      { productId: 'prod-7', name: 'Brake Fluid DOT 4', sku: 'AL-BF-DOT4', unit: '500 ml bottle', quantity: 2, sellingPrice: 6.5, purchaseRate: 3.8, discount: 0, tax: 0 },
    ],
  },
  { id: 'sale-2', billNumber: 'SB-2103', date: dateOffset(0), dateTime: `${dateLabel(0)}, 09:40`, customerName: 'Walk-in Customer', customerType: 'walkin', itemsCount: 1, itemsList: 'Coolant Concentrate (x2)', paymentMode: 'Cash', amount: 17, subtotal: 17, cashReceived: 20, changeGiven: 3, costOfGoodsSold: 10.4, lineItems: [{ productId: 'prod-6', name: 'Coolant Concentrate', sku: 'AL-CC-01', unit: '1 L bottle', quantity: 2, sellingPrice: 8.5, purchaseRate: 5.2, discount: 0, tax: 0 }] },
  { id: 'sale-3', billNumber: 'SB-2102', date: dateOffset(1), dateTime: `${dateLabel(1)}, 16:20`, customerName: 'City Fleet Garage', customerType: 'registered', customerPhone: '+1 555-0102', itemsCount: 1, itemsList: 'Diesel Engine Oil 15W-40 (x3)', paymentMode: 'Credit', amount: 126, subtotal: 126, creditDueDate: dateOffset(-14), costOfGoodsSold: 87, lineItems: [{ productId: 'prod-3', name: 'Diesel Engine Oil 15W-40', sku: 'AL-DEO-1540', unit: '5 L can', quantity: 3, sellingPrice: 42, purchaseRate: 29, discount: 0, tax: 0 }] },
  { id: 'sale-4', billNumber: 'SB-2101', date: dateOffset(2), dateTime: `${dateLabel(2)}, 13:05`, customerName: 'Roadstar Motors', customerType: 'registered', customerPhone: '+1 555-0103', itemsCount: 2, itemsList: 'Gear Oil 80W-90 (x5), Multipurpose Grease (x4)', paymentMode: 'Credit', amount: 82, subtotal: 82, creditDueDate: dateOffset(-12), costOfGoodsSold: 51.4, lineItems: [
    { productId: 'prod-4', name: 'Gear Oil 80W-90', sku: 'AL-GO-8090', unit: '1 L bottle', quantity: 5, sellingPrice: 12, purchaseRate: 7.8, discount: 0, tax: 0 },
    { productId: 'prod-8', name: 'Multipurpose Grease', sku: 'AL-MPG-500', unit: '500 g tub', quantity: 4, sellingPrice: 5.5, purchaseRate: 3.1, discount: 0, tax: 0 },
  ] },
  { id: 'sale-5', billNumber: 'SB-2100', date: dateOffset(5), dateTime: `${dateLabel(5)}, 11:35`, customerName: 'Walk-in Customer', customerType: 'walkin', itemsCount: 1, itemsList: 'Engine Oil 10W-40 Semi-Synthetic (x2)', paymentMode: 'Cash', amount: 22, subtotal: 22, cashReceived: 25, changeGiven: 3, costOfGoodsSold: 14.2, lineItems: [{ productId: 'prod-2', name: 'Engine Oil 10W-40 Semi-Synthetic', sku: 'AL-EO-1040', unit: '1 L bottle', quantity: 2, sellingPrice: 11, purchaseRate: 7.1, discount: 0, tax: 0 }] },
];

export const INITIAL_CREDIT_BILLS: CreditBill[] = [
  { id: 'cr-1', billDate: dateOffset(1), billNumber: 'CR-SB-2102', partyName: 'City Fleet Garage', gstin: '', term: '14 days', status: 'Unpaid', priorBalance: 0, billAmount: 126, netDue: 126, dueDate: dateOffset(-14), remarks: 'Diesel engine oil' },
  { id: 'cr-2', billDate: dateOffset(2), billNumber: 'CR-SB-2101', partyName: 'Roadstar Motors', gstin: '', term: '14 days', status: 'Partially Paid', priorBalance: 0, billAmount: 82, netDue: 52, dueDate: dateOffset(-12), remarks: 'Gear oil and grease' },
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'exp-1', date: dateOffset(0), description: 'Shop electricity', amount: 38, category: 'Utilities', paymentMethod: 'Cash' },
  { id: 'exp-2', date: dateOffset(0), description: 'Local delivery fuel', amount: 22, category: 'Transport', paymentMethod: 'Cash' },
  { id: 'exp-3', date: dateOffset(3), description: 'Shop cleaning supplies', amount: 14, category: 'Maintenance', paymentMethod: 'Cash' },
  { id: 'exp-4', date: dateOffset(8), description: 'Receipt rolls', amount: 9, category: 'Supplies', paymentMethod: 'Cash' },
];

export const INITIAL_PURCHASES: PurchaseBill[] = [
  { id: 'pur-1', invoiceNumber: 'PUR-1088', partyName: 'Prime Oils Wholesale', invoiceDate: dateOffset(0), subtotal: 575, taxShipping: 0, totalAmount: 575, amountPaid: 300, outstandingBalance: 275, remarks: 'Engine and gear oils', items: [
    { id: 'pi-1', productId: 'prod-1', name: 'Engine Oil 5W-30 Synthetic', unit: '1 L bottle', quantity: 25, sellingPrice: 14.5, purchaseRate: 9.2, totalAmount: 230 },
    { id: 'pi-2', productId: 'prod-2', name: 'Engine Oil 10W-40 Semi-Synthetic', unit: '1 L bottle', quantity: 30, sellingPrice: 11, purchaseRate: 7.1, totalAmount: 213 },
    { id: 'pi-3', productId: 'prod-4', name: 'Gear Oil 80W-90', unit: '1 L bottle', quantity: 15, sellingPrice: 12, purchaseRate: 7.8, totalAmount: 117 },
  ] },
  { id: 'pur-2', invoiceNumber: 'PUR-1087', partyName: 'MotorCare Distributors', invoiceDate: dateOffset(4), subtotal: 406, taxShipping: 0, totalAmount: 406, amountPaid: 406, outstandingBalance: 0, remarks: 'Coolant and brake fluid', items: [
    { id: 'pi-4', productId: 'prod-6', name: 'Coolant Concentrate', unit: '1 L bottle', quantity: 40, sellingPrice: 8.5, purchaseRate: 5.2, totalAmount: 208 },
    { id: 'pi-5', productId: 'prod-7', name: 'Brake Fluid DOT 4', unit: '500 ml bottle', quantity: 20, sellingPrice: 6.5, purchaseRate: 3.8, totalAmount: 76 },
  ] },
  { id: 'pur-3', invoiceNumber: 'PUR-1086', partyName: 'AutoChem Supply Co.', invoiceDate: dateOffset(10), subtotal: 522, taxShipping: 0, totalAmount: 522, amountPaid: 200, outstandingBalance: 322, remarks: 'Diesel oil and grease', items: [
    { id: 'pi-6', productId: 'prod-3', name: 'Diesel Engine Oil 15W-40', unit: '5 L can', quantity: 12, sellingPrice: 42, purchaseRate: 29, totalAmount: 348 },
    { id: 'pi-7', productId: 'prod-8', name: 'Multipurpose Grease', unit: '500 g tub', quantity: 20, sellingPrice: 5.5, purchaseRate: 3.1, totalAmount: 62 },
  ] },
];

export const INITIAL_PARTY_LEDGER: PartyLedgerEntry[] = [
  ...INITIAL_CREDIT_BILLS.map((bill) => ({
    id: `pl-${bill.id}`, partyName: bill.partyName, invoiceNumber: bill.billNumber,
    invoiceDate: bill.billDate, billAmount: bill.billAmount, paymentDate: '-', amountPaid: 0,
    outstandingBalance: bill.netDue, transactionType: 'INVOICES' as const, partyType: 'customer' as const,
  })),
  ...INITIAL_CREDIT_BILLS.filter((bill) => bill.netDue < bill.billAmount).map((bill) => ({
    id: `pl-payment-${bill.id}`, partyName: bill.partyName, invoiceNumber: bill.billNumber,
    invoiceDate: bill.billDate, billAmount: 0, paymentDate: dateLabel(0),
    amountPaid: bill.billAmount - bill.netDue, outstandingBalance: bill.netDue,
    transactionType: 'PAYMENTS' as const, paymentMode: 'Cash', partyType: 'customer' as const,
  })),
];

export const INITIAL_SUPPLIER_LEDGER: PartyLedgerEntry[] = [
  ...INITIAL_PURCHASES.map((bill) => ({
    id: `sl-${bill.id}`, partyName: bill.partyName, invoiceNumber: bill.invoiceNumber,
    invoiceDate: bill.invoiceDate, billAmount: bill.totalAmount, paymentDate: '-', amountPaid: 0,
    outstandingBalance: bill.outstandingBalance || 0, transactionType: 'INVOICES' as const, partyType: 'supplier' as const,
  })),
  ...INITIAL_PURCHASES.filter((bill) => (bill.amountPaid || 0) > 0).map((bill) => ({
    id: `sl-payment-${bill.id}`, partyName: bill.partyName, invoiceNumber: bill.invoiceNumber,
    invoiceDate: bill.invoiceDate, billAmount: 0, paymentDate: dateLabel(0),
    amountPaid: bill.amountPaid || 0, outstandingBalance: bill.outstandingBalance || 0,
    transactionType: 'PAYMENTS' as const, paymentMode: 'Bank transfer', partyType: 'supplier' as const,
  })),
];
