import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  LoaderCircle,
  Printer,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  CreditCard,
  ChevronDown,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ExpenseManagementView } from './ExpenseManagementView';
import { formatCurrency } from '../utils/currency';
import { createSalesReturnRequest, getDailySalesReport, getSaleForReturnRequest, settleSalesReturnRequest, ApiSaleReturnDetail } from '../services/api';
import LoaderOne from '../components/ui/loader-one';
import { NumericTextInput } from '../components/ui/NumericTextInput';
import { SaleRecord } from '../types';
import { DEFAULT_PAGE_SIZE, getPageRecords, getPaginationRange, PaginationControls } from '../components/PaginationControls';

type RegisterTab = 'sales' | 'expenses' | 'product-returns' | 'credit-returns';
type PaymentMode = 'all' | 'Cash' | 'Credit' | 'UPI' | 'Coupon' | 'Store Credit';
type TransactionHistoryDetail = { id: string; group: string; label: string; amount: number; method?: string | null; reference?: string | null; date?: string };
type TransactionHistoryEntry = {
  id: string;
  date: string;
  invoiceNumber: string;
  customer: string;
  transactionType: 'Sales Return' | 'Credit Cancellation';
  reason: string;
  amount: number;
  settlementStatus: string;
  staff?: string | null;
  details: TransactionHistoryDetail[];
};
const SALES_RETURN_REASON_PRESETS = [
  'Product defective',
  'Product damaged',
  'Wrong product supplied',
  'Product quality issue',
  'Customer ordered by mistake',
  'Customer changed mind',
  'Other',
] as const;
const formatPaymentAmount = (amount: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(amount) || 0);

const localDate = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const saleDate = (date: string | undefined, dateTime: string) =>
  (date || dateTime.slice(0, 10)).slice(0, 10);

const formatSaleDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
};

const reportDate = (date: string) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${date}T12:00:00`));

const defaultReturnQuantities = (invoice: ApiSaleReturnDetail) => Object.fromEntries(
  invoice.items.map((item) => {
    const remaining = item.displayQuantity != null
      ? Math.max(0, Number(item.displayQuantity) - Number(item.returnedDisplayQuantity || 0))
      : Math.max(0, Number(item.remainingQuantity) || 0);
    return [item.id, remaining === 1 ? '1' : ''];
  }),
);

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const escapeHtml = (value: string | number) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const DailySalesManagementView: React.FC = () => {
  const { expenses, showToast, authSession, refreshCustomers } = useApp();
  const today = localDate(new Date());
  const [activeTab, setActiveTab] = useState<RegisterTab>('sales');
  const [quickDate, setQuickDate] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [modeFilter, setModeFilter] = useState<PaymentMode>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [returnCustomerFilter, setReturnCustomerFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const [apiSales, setApiSales] = useState<SaleRecord[] | null>(null);
  const [apiSalesReturns, setApiSalesReturns] = useState<Array<{ id: string; date: string; invoiceNumber: string; customer: string; reason: string; amount: number; creditAppliedAmount: number; settlementType: string; returnedBy?: string | null; settlements: Array<{ id: string; type: string; amount: number; method?: string | null; reference?: string | null; date: string }> }>>([]);
  const [apiCreditCancellations, setApiCreditCancellations] = useState<Array<{ id: string; date: string; invoiceNumber: string; customer: string; reason: string; amount: number; actualReceivedAmount: number; pendingRefundAmount: number; cancelledBy?: string | null; recordedPayments: Array<{ id: string; method: string; amount: number }>; actualPayments: Array<{ method: string; amount: number }>; paymentCorrections: Array<{ id: string; type: string; method: string; amount: number; date: string }>; refunds: Array<{ id: string; amount: number; method: string; reference?: string | null; date: string }> }>>([]);
  const [invoiceDetail, setInvoiceDetail] = useState<ApiSaleReturnDetail | null>(null);
  const [returnDetailsOnly, setReturnDetailsOnly] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionHistoryEntry | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [expandedReturnGroups, setExpandedReturnGroups] = useState<Record<string, boolean>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnReasonPreset, setReturnReasonPreset] = useState('');
  const [returnSettlement, setReturnSettlement] = useState<'REFUND' | 'CUSTOMER_CREDIT' | 'PENDING'>('REFUND');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'UPI' | 'BANK' | 'OTHER'>('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);
  const returnRequestInFlight = useRef(false);
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false);
  const [pendingSettlementId, setPendingSettlementId] = useState<string | null>(null);
  const [pendingSettlementAmount, setPendingSettlementAmount] = useState('');
  const [pendingSettlementMethod, setPendingSettlementMethod] = useState<'CASH' | 'UPI' | 'BANK' | 'OTHER'>('CASH');
  const [pendingSettlementReference, setPendingSettlementReference] = useState('');
  const [savingPendingSettlement, setSavingPendingSettlement] = useState(false);
  const [refreshRegister, setRefreshRegister] = useState(0);
  const [apiLoading, setApiLoading] = useState(false);
  const [openExpenseModal, setOpenExpenseModal] = useState<() => void>(() => () => {});
  const registerAddExpense = useCallback((openModal: () => void) => setOpenExpenseModal(() => openModal), []);
  const pageSize = DEFAULT_PAGE_SIZE;

  useEffect(() => {
    if (!authSession) { setApiSales([]); setApiSalesReturns([]); setApiCreditCancellations([]); return; }
    const start = new Date(`${fromDate}T12:00:00`);
    const end = new Date(`${toDate}T12:00:00`);
    const dates: string[] = [];
    for (const cursor = new Date(start); cursor <= end && dates.length < 32; cursor.setDate(cursor.getDate() + 1)) dates.push(localDate(cursor));
    if (!dates.length) return;
    let cancelled = false;
    setApiLoading(true);
    void Promise.all(dates.map((date) => getDailySalesReport(authSession.token, date))).then((reports) => {
      if (cancelled) return;
      const rows: SaleRecord[] = [];
      const salesReturns = reports.flatMap((report: any) => (report.salesReturns || []).map((salesReturn: any) => ({
        id: String(salesReturn.id), date: String(salesReturn.date), invoiceNumber: String(salesReturn.invoiceNumber || ''),
        customer: String(salesReturn.customer || 'Walk-in customer'), reason: String(salesReturn.reason || ''),
        amount: Number(salesReturn.amount) || 0, creditAppliedAmount: Number(salesReturn.creditAppliedAmount) || 0,
        settlementType: String(salesReturn.settlementType || ''), returnedBy: salesReturn.returnedBy || null,
        settlements: (salesReturn.settlements || []).map((settlement: any) => ({ id: String(settlement.id), type: String(settlement.type), amount: Number(settlement.amount) || 0, method: settlement.method || null, reference: settlement.reference || null, date: String(settlement.date) })),
      })));
      const creditCancellations = reports.flatMap((report: any) => (report.creditCancellations || []).map((cancellation: any) => ({
        id: String(cancellation.id), date: String(cancellation.date), invoiceNumber: String(cancellation.invoiceNumber || ''),
        customer: String(cancellation.customer || 'Walk-in customer'), reason: String(cancellation.reason || ''),
        amount: Number(cancellation.amount) || 0, actualReceivedAmount: Number(cancellation.actualReceivedAmount) || 0,
        pendingRefundAmount: Number(cancellation.pendingRefundAmount) || 0, cancelledBy: cancellation.cancelledBy || null,
        recordedPayments: (cancellation.recordedPayments || []).map((payment: any) => ({ id: String(payment.id), method: String(payment.method), amount: Number(payment.amount) || 0 })),
        actualPayments: (cancellation.actualPayments || []).map((payment: any) => ({ method: String(payment.method), amount: Number(payment.amount) || 0 })),
        paymentCorrections: (cancellation.paymentCorrections || []).map((correction: any) => ({ id: String(correction.id), type: String(correction.type), method: String(correction.method), amount: Number(correction.amount) || 0, date: String(correction.date) })),
        refunds: (cancellation.refunds || []).map((refund: any) => ({ id: String(refund.id), amount: Number(refund.amount) || 0, method: String(refund.method), reference: refund.reference || null, date: String(refund.date) })),
      })));
      for (const report of reports) for (const invoice of report.invoices || []) {
        const products = invoice.products || [];
        const payments = invoice.payments || [];
        const paymentsOnDate = invoice.paymentsOnDate || payments;
        const isSaleDate = typeof invoice.isSaleDate === 'boolean'
          ? invoice.isSaleDate
          : report.date <= saleDate(undefined, String(invoice.billDate || ''));
        const paymentsReceived = paymentsOnDate.reduce((total: number, payment: any) => {
          const method = String(payment.method || '').toUpperCase();
          return method === 'CASH' || method === 'UPI'
            ? total + (Number(payment.amount) || 0)
            : total;
        }, 0);
        const creditAmount = Number(invoice.creditAmount) || 0;
        const invoiceDiscountTotal = Math.max(
          0,
          Number(invoice.discountAmount ?? invoice.billDiscountAmount ?? 0) || 0,
        );
        const productDiscountTotal = products.reduce(
          (sum: number, product: any) =>
            sum + Math.max(0, Number(product.discountAmount || 0)),
          0,
        );
        const unallocatedDiscount = Math.max(
          0,
          invoiceDiscountTotal - productDiscountTotal,
        );
        const paymentTenders = [
          ...paymentsOnDate.map((payment: any) => ({
            method: payment.method,
            amount: Number(payment.amount) || 0,
            ...(payment.notes ? { notes: payment.notes } : {}),
          })),
          ...(isSaleDate && creditAmount > 0 ? [{ method: 'CREDIT' as const, amount: creditAmount }] : []),
        ];
        const paymentBreakdown = paymentTenders.map((payment: any) => {
          const method = payment.method === 'COUPON' ? 'Coupon' : payment.method === 'STORE_CREDIT' ? 'Store Credit' : payment.method === 'CREDIT' ? 'Credit' : payment.method === 'UPI' ? 'UPI' : 'Cash';
          const code = method === 'Coupon' ? payment.notes?.match(/^Coupon code: (.+)$/)?.[1] : undefined;
          return `${method}${code ? ` ${code}` : ''} ${formatPaymentAmount(Number(payment.amount))}`;
        }).join(' · ');
        const paymentDate = paymentsOnDate[0]?.date || invoice.billDate;
        const itemsList = products.map((product: any) =>
          `${product.productName} × ${product.displayQuantity ?? product.quantity}${product.displayUnitSymbol || product.unitSymbol ? ` ${product.displayUnitSymbol || product.unitSymbol}` : ''}`,
        ).join('\n');
        const discountAmount = productDiscountTotal + unallocatedDiscount;
        if (isSaleDate) {
          rows.push({
            id: String(invoice.saleId || `${report.date}-${invoice.invoiceNumber}`),
            saleId: invoice.saleId ? String(invoice.saleId) : undefined,
            returnStatus: invoice.returnStatus,
            billNumber: invoice.invoiceNumber,
            dateTime: String(invoice.billDate || paymentDate),
            date: String(report.date),
            customerName: invoice.customer,
            customerType: 'registered',
            itemsCount: products.length,
            itemsList,
            paymentMode: paymentBreakdown as any,
            paymentTenders,
            amount: paymentsReceived,
            netSalesAmount: invoice.netSalesAmount != null
              ? Number(invoice.netSalesAmount)
              : Math.max(0, Number(invoice.totalAmount || 0) - (invoice.returns || []).reduce((total: number, salesReturn: any) => total + Number(salesReturn.amount || 0), 0)),
            billTotal: Number(invoice.totalAmount || 0),
            discountAmount,
            subtotal: Number(invoice.lineRevenueTotal ?? invoice.subtotal ?? 0),
            lineItems: products.map((product: any) => ({
            saleItemId: product.saleItemId ? String(product.saleItemId) : undefined,
            productId: String(product.productId || product.id || ''),
            name: String(product.productName || product.name || 'Product'),
            sku: String(product.sku || ''),
            unit: String(product.unitName || product.unitSymbol || product.unit || ''),
            quantity: Number(product.quantity) || 0,
            ...(product.displayQuantity !== undefined && product.displayQuantity !== null
              ? {
                  displayQuantity: Number(product.displayQuantity),
                  displayUnitName: product.displayUnitName || undefined,
                  displayUnitSymbol: product.displayUnitSymbol || undefined,
                }
              : {}),
            sellingPrice: Number(product.sellingPrice || product.unitSellingPrice || product.price || 0),
            lineTotal: product.totalAmount != null || product.lineTotal != null
              ? Number(product.totalAmount ?? product.lineTotal)
              : undefined,
            purchaseRate: 0,
            tax: 0,
            })),
          });
        } else {
          for (const payment of paymentsOnDate) {
            const method = String(payment.method || '').toUpperCase();
            const amount = Number(payment.amount) || 0;
            const methodLabel = method === 'STORE_CREDIT' ? 'Store Credit' : method === 'UPI' ? 'UPI' : method === 'CASH' ? 'Cash' : method;
            rows.push({
              id: `credit-repayment-${String(payment.id)}`,
              saleId: invoice.saleId ? String(invoice.saleId) : undefined,
              isCreditRepayment: true,
              billNumber: invoice.invoiceNumber,
              dateTime: String(payment.date || report.date),
              date: String(report.date),
              customerName: invoice.customer,
              customerType: 'registered',
              itemsCount: 0,
              itemsList: `Credit repayment · ${methodLabel}`,
              paymentMode: `Credit settlement · ${methodLabel} ${formatPaymentAmount(amount)}` as any,
              paymentTenders: [{ method: method as any, amount }],
              amount: method === 'CASH' || method === 'UPI' ? amount : 0,
              netSalesAmount: 0,
              subtotal: 0,
              discountAmount: 0,
              lineItems: [],
            });
          }
        }
      }
      const uniqueRows = new Map<string, SaleRecord>();
      for (const row of rows) uniqueRows.set(row.isCreditRepayment ? row.id : row.saleId || row.id, row);
      setApiSales([...uniqueRows.values()].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));
      setApiSalesReturns(salesReturns);
      setApiCreditCancellations(creditCancellations);
    }).catch((error) => { if (!cancelled) { setApiSales([]); setApiSalesReturns([]); setApiCreditCancellations([]); showToast(error instanceof Error ? error.message : 'Daily sales could not be loaded.', 'error'); } }).finally(() => { if (!cancelled) setApiLoading(false); });
    return () => { cancelled = true; };
  }, [authSession, fromDate, toDate, showToast, refreshRegister]);

  const openInvoice = async (saleId: string, fromReturnButton = false) => {
    if (!authSession) return;
    setInvoiceLoading(true);
    setInvoiceDetail(null);
    setReturnDetailsOnly(false);
    setReturnQuantities({});
    setExpandedReturnGroups({});
    setReturnReason('');
    setReturnNotes('');
    setReturnReasonPreset('');
    setReturnSettlement('REFUND');
    setPendingSettlementId(null);
    try {
      const invoice = await getSaleForReturnRequest(authSession.token, saleId);
      setInvoiceDetail(invoice);
      setReturnDetailsOnly(
        fromReturnButton &&
          (invoice.returnStatus === 'FULLY_RETURNED' ||
            (invoice.items.length > 0 &&
              invoice.items.every((item) => Number(item.remainingQuantity) <= 0.0000001))),
      );
      setReturnQuantities(defaultReturnQuantities(invoice));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice details could not be loaded.', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const returnPreview = (() => {
    if (!invoiceDetail) return { items: [] as Array<{ saleItemId: string; productName: string; quantity: number; displayQuantity: number; unitLabel: string; amount: number }>, amount: 0, creditApplied: 0, settlementAmount: 0 };
    const lineRevenueTotal = invoiceDetail.items.reduce((total, item) => total + (Number(item.lineTotal) || 0), 0);
    let allocatedBefore = 0;
    const items: Array<{ saleItemId: string; productName: string; quantity: number; displayQuantity: number; unitLabel: string; amount: number }> = [];
    for (const [index, item] of invoiceDetail.items.entries()) {
      const lineTotal = Number(item.lineTotal) || 0;
      const allocatedRevenue = index === invoiceDetail.items.length - 1
        ? Number(invoiceDetail.totalAmount) - allocatedBefore
        : lineRevenueTotal > 0 ? Math.round((Number(invoiceDetail.totalAmount) * lineTotal / lineRevenueTotal) * 100) / 100 : 0;
      allocatedBefore += allocatedRevenue;
      const entered = Number(returnQuantities[item.id] || 0);
      if (!entered) continue;
      const originalQuantity = Number(item.quantity) || 0;
      const displayQuantity = Number(item.displayQuantity) || 0;
      const quantity = displayQuantity > 0 ? entered * originalQuantity / displayQuantity : entered;
      const remainingQuantity = Number(item.remainingQuantity) || 0;
      if (quantity <= 0 || quantity > remainingQuantity + 0.0000001 || originalQuantity <= 0) continue;
      const previousAmount = Number(item.returnedAmount) || 0;
      const remainingAmount = Math.max(0, allocatedRevenue - previousAmount);
      const amount = Math.abs(quantity - remainingQuantity) < 0.0000001
        ? remainingAmount
        : Math.round(allocatedRevenue * quantity / originalQuantity * 100) / 100;
      items.push({ saleItemId: item.id, productName: item.productName, quantity, displayQuantity: entered, unitLabel: item.displayUnitSymbol || item.displayUnitName || item.unitSymbol || item.unitName, amount });
    }
    const amount = Math.round(items.reduce((total, item) => total + item.amount, 0) * 100) / 100;
    const outstanding = invoiceDetail.creditBill
      ? Math.max(0, Number(invoiceDetail.creditBill.billAmount) - Number(invoiceDetail.creditBill.paidAmount))
      : 0;
    const creditApplied = Math.min(amount, outstanding);
    return { items, amount, creditApplied, settlementAmount: Math.max(0, amount - creditApplied) };
  })();
  const returnProductGroups = (() => {
    if (!invoiceDetail) return [];
    const groups = new Map<string, {
      key: string;
      productId: string;
      productName: string;
      sellingPrice: number;
      sold: number;
      returned: number;
      remaining: number;
      requested: number;
      amount: number;
      lines: Array<{ item: ApiSaleReturnDetail['items'][number]; sold: number; returned: number; remaining: number; requested: number; amount: number }>;
    }>();
    for (const item of invoiceDetail.items) {
      const key = `${item.productId}:${Number(item.unitSellingPrice).toFixed(2)}`;
      const sold = item.displayQuantity != null ? Number(item.displayQuantity) : Number(item.quantity);
      const returned = item.displayQuantity != null ? Number(item.returnedDisplayQuantity || 0) : Number(item.returnedQuantity);
      const remaining = Math.max(0, sold - returned);
      const requested = Number(returnQuantities[item.id] || 0);
      const amount = returnPreview.items.find((line) => line.saleItemId === item.id)?.amount || 0;
      const group = groups.get(key) || {
        key, productId: item.productId, productName: item.productName,
        sellingPrice: Number(item.unitSellingPrice), sold: 0, returned: 0,
        remaining: 0, requested: 0, amount: 0, lines: [],
      };
      group.sold += sold;
      group.returned += returned;
      group.remaining += remaining;
      group.requested += requested;
      group.amount += amount;
      group.lines.push({ item, sold, returned, remaining, requested, amount });
      groups.set(key, group);
    }
    return [...groups.values()];
  })();
  const canViewReturnCost = authSession?.user.role === 'ADMIN';

  const submitSalesReturn = async () => {
    if (!authSession || !invoiceDetail || savingReturn || returnRequestInFlight.current || !returnReason.trim() || !returnPreview.items.length) return;
    if (returnSettlement === 'CUSTOMER_CREDIT' && returnPreview.settlementAmount > 0 && !invoiceDetail.customer) {
      showToast('Customer credit requires a registered customer on this invoice.', 'error');
      return;
    }
    returnRequestInFlight.current = true;
    setSavingReturn(true);
    try {
      const saleId = invoiceDetail.id;
      const submittedItems = returnPreview.items;
      await createSalesReturnRequest(authSession.token, saleId, {
        idempotencyKey: crypto.randomUUID(),
        reason: [returnReason.trim(), returnNotes.trim()].filter(Boolean).join(' — '),
        settlementType: returnSettlement,
        items: returnPreview.items.map((item) => ({ saleItemId: item.saleItemId, quantity: item.quantity })),
        ...(returnSettlement === 'REFUND' && returnPreview.settlementAmount > 0 ? { refunds: [{ amount: returnPreview.settlementAmount, method: refundMethod, ...(refundReference.trim() ? { reference: refundReference.trim() } : {}) }] } : {}),
      });
      setConfirmReturnOpen(false);
      setReturnReason('');
      setReturnReasonPreset('');
      setReturnNotes('');
      void refreshCustomers();
      setRefreshRegister((value) => value + 1);
      const optimisticItems = invoiceDetail.items.map((item) => {
        const returned = submittedItems.find((entry) => entry.saleItemId === item.id);
        if (!returned) return item;
        return {
          ...item,
          returnedQuantity: Number(item.returnedQuantity) + returned.quantity,
          returnedAmount: Number(item.returnedAmount) + returned.amount,
          remainingQuantity: Math.max(0, Number(item.remainingQuantity) - returned.quantity),
          ...(item.displayQuantity != null
            ? { returnedDisplayQuantity: Number(item.returnedDisplayQuantity || 0) + returned.displayQuantity }
            : {}),
        };
      });
      const fullyReturned = optimisticItems.every((item) => Number(item.remainingQuantity) <= 0.0000001);
      const optimisticInvoice = {
        ...invoiceDetail,
        items: optimisticItems,
        returnStatus: fullyReturned ? 'FULLY_RETURNED' as const : 'PARTIALLY_RETURNED' as const,
      };
      setInvoiceDetail(optimisticInvoice);
      setReturnQuantities(defaultReturnQuantities(optimisticInvoice));
      try {
        const refreshedInvoice = await getSaleForReturnRequest(authSession.token, saleId);
        setInvoiceDetail(refreshedInvoice);
        setReturnQuantities(defaultReturnQuantities(refreshedInvoice));
      } catch {
        showToast('Sales return was recorded, but the invoice details could not be refreshed.', 'error');
      }
      showToast('Sales return recorded and original stock batches restored.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The sales return could not be recorded.', 'error');
    } finally {
      returnRequestInFlight.current = false;
      setSavingReturn(false);
    }
  };

  const handleReturnReasonChange = (value: string) => {
    setReturnReason(value);
    setReturnReasonPreset(SALES_RETURN_REASON_PRESETS.find((preset) => preset === value) || (value ? 'Other' : ''));
  };

  const settlePendingRefund = async (salesReturnId: string) => {
    if (!authSession || !invoiceDetail || savingPendingSettlement || !Number(pendingSettlementAmount)) return;
    const amount = Number(pendingSettlementAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!window.confirm(`Record a refund payment of ${formatCurrency(amount)} for this pending sales return?`)) return;
    setSavingPendingSettlement(true);
    try {
      await settleSalesReturnRequest(authSession.token, salesReturnId, {
        idempotencyKey: crypto.randomUUID(),
        refunds: [{ amount, method: pendingSettlementMethod, ...(pendingSettlementReference.trim() ? { reference: pendingSettlementReference.trim() } : {}) }],
      });
      setInvoiceDetail(await getSaleForReturnRequest(authSession.token, invoiceDetail.id));
      setPendingSettlementId(null);
      setPendingSettlementAmount('');
      setPendingSettlementReference('');
      setRefreshRegister((value) => value + 1);
      showToast('Pending refund settlement recorded.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The pending refund could not be settled.', 'error');
    } finally {
      setSavingPendingSettlement(false);
    }
  };

  const inRange = (date: string) => date >= fromDate && date <= toDate;
  const rangeSales = (apiSales ?? [])
    .filter((sale) => inRange(saleDate(sale.date, sale.dateTime)))
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  const rangeExpenses = expenses.filter((expense) => inRange(expense.date.slice(0, 10)));
  const query = searchTerm.toLowerCase().trim();
  const transactionHistory: TransactionHistoryEntry[] = [
    ...apiSalesReturns.filter((row) => inRange(row.date.slice(0, 10))).map((row): TransactionHistoryEntry => {
      const refunds = row.settlements.filter((settlement) => settlement.type === 'REFUND');
      const refundedAmount = refunds.reduce((total, refund) => total + refund.amount, 0);
      const pendingAmount = row.settlementType === 'PENDING' ? Math.max(0, row.amount - row.creditAppliedAmount - refundedAmount) : 0;
      const customerCredit = row.settlements.filter((settlement) => settlement.type === 'CUSTOMER_CREDIT').reduce((total, settlement) => total + settlement.amount, 0);
      const settlementStatus = pendingAmount > 0
        ? 'Refund pending'
        : customerCredit > 0
          ? 'Credit issued'
          : refundedAmount > 0
            ? 'Refund completed'
            : row.settlementType === 'BALANCE_OFFSET'
              ? 'No Refund Required'
              : 'Settlement not recorded';
      const details: TransactionHistoryDetail[] = [];
      if (row.creditAppliedAmount > 0) details.push({ id: `${row.id}-balance`, group: 'Settlement details', label: 'Applied to invoice balance', amount: row.creditAppliedAmount });
      row.settlements.filter((settlement) => settlement.type === 'CUSTOMER_CREDIT').forEach((settlement) => details.push({ id: settlement.id, group: 'Settlement details', label: 'Credit issued', amount: settlement.amount, date: settlement.date }));
      refunds.forEach((refund) => details.push({ id: refund.id, group: 'Settlement details', label: 'Refund completed', amount: refund.amount, method: refund.method, reference: refund.reference, date: refund.date }));
      if (pendingAmount > 0) details.push({ id: `${row.id}-pending`, group: 'Settlement details', label: 'Refund Pending', amount: pendingAmount });
      if (!details.length) details.push({ id: `${row.id}-none`, group: 'Settlement details', label: 'No refund or credit settlement required', amount: 0 });
      return { id: `return-${row.id}`, date: row.date, invoiceNumber: row.invoiceNumber, customer: row.customer, transactionType: 'Sales Return', reason: row.reason, amount: row.amount, settlementStatus, staff: row.returnedBy, details };
    }),
    ...apiCreditCancellations.filter((row) => inRange(row.date.slice(0, 10))).map((row): TransactionHistoryEntry => {
      const refundedAmount = row.refunds.reduce((total, refund) => total + refund.amount, 0);
      const settlementStatus = row.pendingRefundAmount > 0 && refundedAmount > 0
        ? 'Partially Refunded · Refund Pending'
        : row.pendingRefundAmount > 0
          ? 'Refund Pending'
          : refundedAmount > 0
            ? 'Refunded'
            : 'No Refund Required';
      const details: TransactionHistoryDetail[] = [
        ...row.recordedPayments.map((payment) => ({ id: `recorded-${payment.id}`, group: 'Original recorded payments', label: payment.method, amount: payment.amount })),
        ...row.actualPayments.map((payment, index) => ({ id: `actual-${row.id}-${payment.method}-${index}`, group: 'Verified actual payment', label: payment.method, amount: payment.amount })),
        ...row.paymentCorrections.map((correction) => ({ id: correction.id, group: 'Payment corrections', label: correction.type === 'REVERSAL' ? `Reversed recorded ${correction.method}` : `Verified ${correction.method} receipt`, amount: correction.amount, date: correction.date })),
        ...row.refunds.map((refund) => ({ id: refund.id, group: 'Refund settlements', label: 'Refunded', amount: refund.amount, method: refund.method, reference: refund.reference, date: refund.date })),
      ];
      if (row.pendingRefundAmount > 0) details.push({ id: `${row.id}-pending`, group: 'Refund settlements', label: 'Refund Pending', amount: row.pendingRefundAmount });
      if (!details.some((detail) => detail.group === 'Refund settlements')) details.push({ id: `${row.id}-none`, group: 'Refund settlements', label: 'No refund required', amount: 0 });
      return { id: `cancellation-${row.id}`, date: row.date, invoiceNumber: row.invoiceNumber, customer: row.customer, transactionType: 'Credit Cancellation', reason: row.reason, amount: row.amount, settlementStatus, staff: row.cancelledBy, details };
    }),
  ]
    .filter((row) => !query || [row.invoiceNumber, row.customer, row.transactionType, row.reason, row.settlementStatus].some((value) => value.toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const returnCustomerOptions = [...new Set((activeTab === 'product-returns' ? apiSalesReturns : apiCreditCancellations)
    .filter((row) => inRange(row.date.slice(0, 10)))
    .map((row) => row.customer))].sort((a, b) => a.localeCompare(b));
  const productReturns = transactionHistory.filter((row) => row.transactionType === 'Sales Return' && (returnCustomerFilter === 'all' || row.customer === returnCustomerFilter));
  const creditReturns = transactionHistory.filter((row) => row.transactionType === 'Credit Cancellation' && (returnCustomerFilter === 'all' || row.customer === returnCustomerFilter));
  const filteredSales = rangeSales.filter((sale) => {
    const hasOnlyCreditTenders = Array.isArray(sale.paymentTenders) && sale.paymentTenders.length > 0 && sale.paymentTenders.every((tender) => String(tender.method).toUpperCase() === 'CREDIT');
    const matchesMode = modeFilter === 'all'
      ? !hasOnlyCreditTenders
      : sale.paymentMode === modeFilter || sale.paymentMode.includes(`${modeFilter} `);
    const matchesSearch = !query || sale.billNumber.toLowerCase().includes(query) || sale.customerName.toLowerCase().includes(query) || sale.itemsList.toLowerCase().includes(query) || sale.paymentMode.toLowerCase().includes(query);
    return matchesMode && matchesSearch;
  });
  const matchingExpenses = rangeExpenses.filter((expense) => !query || expense.description.toLowerCase().includes(query) || Boolean(expense.category?.toLowerCase().includes(query)) || Boolean(expense.notes?.toLowerCase().includes(query)));

  const pageCount = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageSales = getPageRecords(filteredSales, safePage, pageSize);
  const salesRange = getPaginationRange(filteredSales.length, safePage, pageSize);
  const activeReturnRows = activeTab === 'product-returns' ? productReturns : creditReturns;
  const transactionPageCount = Math.max(1, Math.ceil(activeReturnRows.length / pageSize));
  const safeTransactionPage = Math.min(transactionPage, transactionPageCount);
  const pageTransactions = getPageRecords(activeReturnRows, safeTransactionPage, pageSize);
  const transactionRange = getPaginationRange(activeReturnRows.length, safeTransactionPage, pageSize);
  const printSalesTotal = filteredSales.reduce((sum, sale) => sum + (sale.netSalesAmount ?? sale.amount), 0);
  const printPaymentsTotal = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const printExpensesTotal = matchingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
console.log(pageSales,"pageSales");

  useEffect(() => {
    setPage(1);
    setTransactionPage(1);
  }, [activeTab, fromDate, toDate, modeFilter, searchTerm, returnCustomerFilter]);

  const selectToday = () => {
    const date = localDate(new Date());
    setQuickDate('today');
    setFromDate(date);
    setToDate(date);
  };

  const selectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = localDate(yesterday);
    setQuickDate('yesterday');
    setFromDate(date);
    setToDate(date);
  };

  const handlePrintRegister = () => {
    const previousTitle = document.title;
    const registerName = activeTab === 'sales' ? 'Daily Sales Register'
      : activeTab === 'expenses' ? 'Daily Expenses Register'
        : activeTab === 'product-returns' ? 'Product Returns' : 'Credit Returns';
    document.title = `Able Lubes - ${registerName}`;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
  };

  const handlePrintSale = (sale: (typeof filteredSales)[number]) => {
    const printWindow = window.open('', '_blank', 'width=400,height=760');
    if (!printWindow) {
      showToast('Allow pop-ups to print or save the sale receipt.', 'error');
      return;
    }

    const lineItems = sale.lineItems || [];
    const tenders = sale.paymentTenders || [];
    const paidAmount = tenders.filter((tender) => tender.method !== 'CREDIT').reduce((sum, tender) => sum + Number(tender.amount || 0), 0);
    const billTotal = Number(sale.billTotal ?? sale.amount);
    const productRows = lineItems.length
      ? lineItems.map((item) => {
          const quantity = item.displayQuantity !== undefined
            ? `${item.displayQuantity} ${item.displayUnitName || item.displayUnitSymbol || ''}`.trim()
            : `${item.quantity} ${item.unit || ''}`.trim();
          const lineTotal = item.lineTotal ?? item.quantity * item.sellingPrice;
          return `<tr><td class="item"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(quantity)}</small></td><td class="number">${escapeHtml(formatCurrency(lineTotal))}</td></tr>`;
        }).join('')
      : `<tr><td colspan="2">${escapeHtml(sale.itemsList || 'Item details unavailable')}</td></tr>`;
    const isSettlement = sale.paymentMode.includes('Credit settlement');
    const hasNamedCustomer = Boolean(sale.customerName?.trim()) && !/walk[- ]in/i.test(sale.customerName);
    const balanceDue = Math.max(0, billTotal - paidAmount);
    const itemCount = Math.max(1, lineItems.length);
    const wrappedItemLines = lineItems.reduce((lines, item) => lines + Math.max(0, Math.ceil(item.name.length / 30) - 1), 0);
    const receiptHeightMm = Math.ceil(52 + itemCount * 10 + wrappedItemLines * 4 + (balanceDue > 0 && !isSettlement ? 7 : 0));

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Able Lubes - Sales Receipt</title>
      <style>
        @page { size: 80mm ${receiptHeightMm}mm; margin: 0; }
        * { box-sizing: border-box; }
        html,body { width:80mm; margin:0; padding:0; color:#111; background:#fff; font:10px/1.35 Arial,Helvetica,sans-serif; }
        body { padding:3mm; }
        .receipt { width:74mm; margin:0 auto; }
        header { text-align:center; padding-bottom:2.5mm; border-bottom:1px dashed #555; }
        .brand { font-size:16px; font-weight:800; letter-spacing:.04em; }
        header p { margin:1mm 0 0; font-size:9px; }
        .meta { padding:2.5mm 0; border-bottom:1px dashed #555; }
        .line { display:flex; justify-content:space-between; gap:2mm; margin:1mm 0; }
        .meta .line span:first-child { color:#444; }
        table { width:100%; margin:2mm 0; border-collapse:collapse; }
        th,td { padding:1.5mm 0; border-bottom:1px dotted #999; text-align:left; vertical-align:top; }
        th:last-child,.number { text-align:right; white-space:nowrap; }
        .item small { display:block; margin-top:.5mm; color:#444; font-size:9px; }
        .totals { margin-top:2mm; border-top:1px solid #111; border-bottom:1px solid #111; font-size:13px; font-weight:700; }
        .totals td { border:0; }
        .due { margin-top:2mm; font-weight:700; }
        footer { margin-top:4mm; padding-top:2mm; border-top:1px dashed #555; text-align:center; font-size:9px; }
        @media screen { body { margin:12px auto; box-shadow:0 1px 8px #bbb; } }
      </style></head><body><main class="receipt">
      <header><div class="brand">ABLE LUBES</div><p>${escapeHtml(isSettlement ? 'PAYMENT RECEIPT' : 'SALES RECEIPT')}</p></header>
      <section class="meta"><div class="line"><span>${isSettlement ? 'Reference' : 'Bill number'}</span><strong>${escapeHtml(sale.billNumber)}</strong></div><div class="line"><span>Date</span><span>${escapeHtml(formatSaleDateTime(sale.dateTime))}</span></div>${hasNamedCustomer ? `<div class="line"><span>Customer</span><span>${escapeHtml(sale.customerName)}</span></div>` : ''}</section>
      ${isSettlement ? '' : `<table><thead><tr><th>Product / Qty</th><th class="number">Amount</th></tr></thead><tbody>${productRows}</tbody></table>`}
      <table class="totals"><tbody><tr><td>${isSettlement ? 'Payment received' : 'Bill total'}</td><td class="number">${escapeHtml(formatCurrency(isSettlement ? sale.amount : billTotal))}</td></tr></tbody></table>
      ${!isSettlement && balanceDue > 0 ? `<div class="line due"><span>Balance due</span><span>${escapeHtml(formatCurrency(balanceDue))}</span></div>` : ''}
      <footer>Thank you for shopping with us.</footer></main></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.onafterprint = () => printWindow.close();
      printWindow.print();
    }, 250);
  };

  const handleExportDaySheet = () => {
    const salesRows = [
      ['Date & Time', 'Bill Number', 'Customer', 'Product', 'Payment Received (INR)', 'Net Sales (INR)', 'Bill Total (INR)', 'Discount Given (INR)', 'Payment Mode'],
      ...filteredSales.map((sale) => [formatSaleDateTime(sale.dateTime), sale.billNumber, sale.customerName, sale.itemsList, formatCurrency(sale.amount), formatCurrency(sale.netSalesAmount ?? sale.billTotal ?? 0), sale.paymentMode.includes('Credit settlement') && sale.billTotal !== undefined ? formatCurrency(sale.billTotal) : '', (sale.discountAmount || 0) > 0 ? formatCurrency(sale.discountAmount || 0) : '', sale.paymentMode]),
    ];
    const expenseRows = [
      [],
      ['Expenses'],
      ['Date', 'Description', 'Category', 'Payment Method', 'Notes', 'Amount (INR)'],
      ...matchingExpenses.map((expense) => [expense.date, expense.description, expense.category || '', expense.paymentMethod || '', expense.notes || '', formatCurrency(expense.amount)]),
    ];
    const csv = [...salesRows, ...expenseRows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daily_Register_${fromDate}_to_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Day Sheet exported successfully.');
  };

  return (
    <div className="daily-register-page w-full">
      <div className="daily-register-screen flex w-full flex-col gap-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Daily register records" className="inline-flex w-fit max-w-full flex-wrap items-center rounded-full border border-[#e9e3d9] bg-white p-1 shadow-[0_3px_12px_rgba(37,27,12,.08)]">
          {([
            { id: 'sales', label: 'Sales', count: filteredSales.length, icon: ShoppingCart },
            { id: 'expenses', label: 'Expenses', count: matchingExpenses.length, icon: FileText },
            { id: 'product-returns', label: 'Product Returns', count: productReturns.length, icon: RotateCcw },
            { id: 'credit-returns', label: 'Credit Returns', count: creditReturns.length, icon: CreditCard },
          ] as const).map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${activeTab === id ? 'text-[#493819]' : 'text-[#6b665c] hover:text-[#272727]'}`}
            >
              {activeTab === id && <motion.span layoutId="daily-register-tab-indicator" className="absolute inset-0 rounded-full bg-[#fff1c9] shadow-sm" transition={{ duration: 0.24, ease: 'easeOut' }} aria-hidden="true" />}
              <span className="relative z-10 inline-flex items-center gap-2"><Icon size={17} aria-hidden="true" />{label}<span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{count}</span></span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeTab === 'expenses' && <button type="button" onClick={openExpenseModal} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-3 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82]">
            <Plus size={17} aria-hidden="true" /> Add Expense
          </button>}
          <button type="button" onClick={handlePrintRegister} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e9e3d9] bg-white px-3 text-sm font-semibold text-[#272727] shadow-sm transition hover:bg-[#f8f6f2]">
            <Printer size={17} aria-hidden="true" /> Print {activeTab === 'sales' ? 'Sales' : activeTab === 'expenses' ? 'Expenses' : activeTab === 'product-returns' ? 'Product Returns' : 'Credit Returns'} / Save PDF
          </button>
          {/* <button type="button" onClick={handleExportDaySheet} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-3 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82]">
            <Download size={17} aria-hidden="true" /> Export Day Sheet
          </button> */}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-[#e9e3d9] bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between" aria-label="Register filters">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#f5f3ef] p-1">
            <button type="button" onClick={selectToday} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${quickDate === 'today' ? 'bg-[#ffe4a0] text-[#493819] shadow-sm' : 'text-[#68645e] hover:bg-white'}`}>Today</button>
            <button type="button" onClick={selectYesterday} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${quickDate === 'yesterday' ? 'bg-[#ffe4a0] text-[#493819] shadow-sm' : 'text-[#68645e] hover:bg-white'}`}>Yesterday</button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#efdcae] bg-[#fff7e7] p-1.5">
            <label className="flex items-center gap-1.5" aria-label="From date">
              <CalendarDays size={16} className="shrink-0 text-[#89795c]" aria-hidden="true" />
              <input type="date" aria-label="From date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setQuickDate('custom'); }} className="h-8 min-w-[130px] rounded-md border border-[#ead8ad] bg-[#fffdf8] px-2 text-xs text-[#272727] outline-none focus:border-[#c58a00]" />
            </label>
            <span className="text-xs font-medium text-[#89795c]">to</span>
            <label className="flex items-center gap-1.5" aria-label="To date">
              <CalendarDays size={16} className="shrink-0 text-[#89795c]" aria-hidden="true" />
              <input type="date" aria-label="To date" value={toDate} onChange={(event) => { setToDate(event.target.value); setQuickDate('custom'); }} className="h-8 min-w-[130px] rounded-md border border-[#ead8ad] bg-[#fffdf8] px-2 text-xs text-[#272727] outline-none focus:border-[#c58a00]" />
            </label>
          </div>
          {activeTab === 'sales' && <label className="flex items-center gap-2 text-xs font-semibold text-[#77736d]" htmlFor="register-payment-mode">
            <span>Mode</span>
            <select
              id="register-payment-mode"
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value as PaymentMode)}
              className="h-9 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-medium text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white"
            >
              <option value="all">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
              <option value="UPI">UPI</option>
              <option value="Coupon">Coupon</option>
              <option value="Store Credit">Store Credit</option>
            </select>
          </label>}
          {(activeTab === 'product-returns' || activeTab === 'credit-returns') && <label className="flex items-center gap-2 text-xs font-semibold text-[#77736d]" htmlFor="return-customer-filter">
            <span>Customer</span>
            <select id="return-customer-filter" value={returnCustomerFilter} onChange={(event) => setReturnCustomerFilter(event.target.value)} className="h-9 max-w-[220px] rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-medium text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white">
              <option value="all">All customers</option>
              {returnCustomerOptions.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
            </select>
          </label>}
        </div>
        <label className="relative block w-full lg:max-w-[320px]">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#89847b]" aria-hidden="true" />
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={activeTab === 'sales' ? 'Search bill, customer or product…' : activeTab === 'expenses' ? 'Search expense or category…' : 'Search invoice, customer or reason…'} className="h-10 w-full rounded-lg border border-[#e8e4dd] bg-[#f7f7f6] pl-9 pr-3 text-sm text-[#272727] outline-none placeholder:text-[#89847b] focus:border-[#c58a00] focus:bg-white" aria-label={activeTab === 'sales' ? 'Search sales' : activeTab === 'expenses' ? 'Search expenses' : activeTab === 'product-returns' ? 'Search product returns' : 'Search credit returns'} />
        </label>
      </section>

      <AnimatePresence mode="wait" initial={false}>
      {activeTab === 'sales' ? (
        <motion.section key="sales-panel" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden rounded-xl border border-[#e9e3d9] bg-white shadow-sm" role="tabpanel" aria-label="Sales records">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse text-left">
              <thead><tr className="h-10 bg-[#f6f5f2] text-xs font-bold uppercase tracking-wide text-[#6d685f]">
                <th className="px-4 py-2">Date &amp; time</th><th className="px-4 py-2">Bill number</th><th className="px-4 py-2">Product name</th><th className="px-4 py-2 text-right">Payments received (₹)</th><th className="px-4 py-2 text-center">Mode of payment</th><th className="px-4 py-2 text-center">Return</th><th className="px-4 py-2 text-center">Receipt</th>
              </tr></thead>
              <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                {apiLoading ? (
                  <tr><td colSpan={7} className="px-4 py-14 text-center"><LoaderOne /></td></tr>
                ) : pageSales.map((item) => (
                  <tr key={item.id} className="h-11 transition hover:bg-[#fffdf8]">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-[#68645e]">{formatSaleDateTime(item.dateTime)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-semibold text-[#a86600]">
                      {item.billNumber}
                      {item.isCreditRepayment && <span className="mt-1 block text-[10px] font-semibold text-[#68645e]">Credit repayment</span>}
                      {item.returnStatus && item.returnStatus !== 'NONE' && <span className={`mt-1 block rounded-full px-2 py-0.5 text-[10px] font-bold ${item.returnStatus === 'FULLY_RETURNED' ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#FFEDD5] text-[#9A3412]'}`}>{item.returnStatus === 'FULLY_RETURNED' ? 'Fully Returned' : 'Partially Returned'}</span>}
                    </td>
                    <td className="max-w-[440px] px-4 py-2">
                      <div className="space-y-1" title={item.itemsList}>
                        {item.itemsList.split('\n').map((productName, index) => (
                          <div key={`${item.id}-${index}`} className="truncate">{productName}</div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">
                      <span>{formatCurrency(item.amount)}</span>
                      {item.netSalesAmount !== undefined && <span className="mt-1 block text-[11px] font-medium text-[#4c6b45]">Net sale {formatCurrency(item.netSalesAmount)}</span>}
                      {(item.discountAmount || 0) > 0 && (
                        <span className="mt-1 block text-[11px] font-medium text-[#9a6700]">
                          Discount {formatCurrency(item.discountAmount || 0)}
                        </span>
                      )}
                      {item.paymentMode.includes('Credit settlement') && item.billTotal !== undefined && (
                        <span className="mt-1 block text-[11px] font-medium text-[#68645e]">
                          Bill total {formatCurrency(item.billTotal)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex max-w-[290px] flex-wrap justify-center gap-1.5">
                        {(item.paymentTenders || []).map((tender, index) => {
                          const method = tender.method === 'STORE_CREDIT' ? 'Store Credit'
                            : tender.method === 'CREDIT' ? 'Credit'
                              : tender.method === 'COUPON' ? 'Coupon'
                                : tender.method === 'UPI' ? 'UPI' : 'Cash';
                          const tone = tender.method === 'UPI' ? 'bg-[#eee9ff] text-[#5940a5]'
                            : tender.method === 'CREDIT' ? 'bg-[#fff2d5] text-[#805600]'
                              : tender.method === 'STORE_CREDIT' ? 'bg-[#eaf5ed] text-[#376449]'
                                : tender.method === 'COUPON' ? 'bg-[#f1efff] text-[#5940a5]'
                                  : 'bg-[#f0f0ed] text-[#45443f]';
                          return <span key={`${tender.method}-${index}`} className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ${tone}`}>
                            {item.paymentMode.includes('Credit settlement') ? 'Credit settlement · ' : ''}{method} {formatCurrency(tender.amount)}
                          </span>;
                        })}
                        {!(item.paymentTenders || []).length && <span className="text-xs text-[#77736d]">No payment recorded</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" disabled={!item.saleId || item.isCreditRepayment} onClick={() => item.saleId && !item.isCreditRepayment && void openInvoice(item.saleId, true)} className="h-8 rounded-md border border-[#e8e4dd] bg-white px-3 text-xs font-semibold text-[#493819] transition hover:bg-[#fff7e7] disabled:cursor-not-allowed disabled:opacity-50">Return</button>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => handlePrintSale(item)} title="Print or save receipt as PDF" aria-label={`Print receipt for ${item.billNumber}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e8e4dd] bg-white px-2.5 text-xs font-semibold text-[#493819] transition hover:bg-[#fff7e7]">
                        <Printer size={15} aria-hidden="true" /><span>Print / PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!apiLoading && filteredSales.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#77736d]">No sales match this date range and filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t border-[#eee8df] bg-[#f8f7f4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b665c]">
              <span>Showing <strong className="text-[#272727]">{salesRange.start}-{salesRange.end}</strong> of <strong className="text-[#272727]">{filteredSales.length}</strong> bills</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-4">
              <div className="text-right"><div className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Net sales total</div><div className="text-xl font-extrabold text-[#493819]">{formatCurrency(printSalesTotal)}</div></div>
              <PaginationControls totalRecords={filteredSales.length} page={safePage} pageSize={pageSize} onPageChange={setPage} />
            </div>
          </footer>
        </motion.section>
      ) : activeTab === 'expenses' ? (
        <motion.div key="expenses-panel" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }} role="tabpanel" aria-label="Expense records">
          <ExpenseManagementView embedded dateRange={{ from: fromDate, to: toDate }} sharedSearchTerm={searchTerm} onRegisterAddExpense={registerAddExpense} />
        </motion.div>
      ) : (
        <motion.section key={`${activeTab}-panel`} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden rounded-xl border border-[#e9e3d9] bg-white shadow-sm" role="tabpanel" aria-label={activeTab === 'product-returns' ? 'Product return records' : 'Credit return records'}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eee8df] px-4 py-3">
            <div><h2 className="text-sm font-bold text-[#272727]">{activeTab === 'product-returns' ? 'Product Returns' : 'Credit Returns'}</h2></div>
            <strong className="text-sm text-[#a86600]">{activeReturnRows.length} records</strong>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead><tr className="h-10 bg-[#f6f5f2] text-xs font-bold uppercase tracking-wide text-[#6d685f]"><th className="px-4 py-2">Date &amp; time</th><th className="px-4 py-2">Invoice</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Settlement status</th></tr></thead><tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
            {apiLoading ? <tr><td colSpan={6} className="px-4 py-14 text-center"><LoaderOne /></td></tr> : pageTransactions.map((transaction) => <tr key={transaction.id} className="transition hover:bg-[#fcfbf9]"><td className="whitespace-nowrap px-4 py-2 text-xs text-[#68645e]">{formatSaleDateTime(transaction.date)}</td><td className="px-4 py-2"><button type="button" onClick={() => setSelectedTransaction(transaction)} title="Open transaction details" className="font-semibold text-[#a86600] hover:underline">{transaction.invoiceNumber}</button></td><td className="px-4 py-2">{transaction.customer}</td><td className="max-w-[260px] truncate px-4 py-2" title={transaction.reason}>{transaction.reason || '—'}</td><td className="whitespace-nowrap px-4 py-2 text-right font-semibold">{formatCurrency(transaction.amount)}</td><td className="px-4 py-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${transaction.settlementStatus.includes('Pending') ? 'bg-[#fff5d9] text-[#765000]' : transaction.settlementStatus === 'Refunded' ? 'bg-[#eaf5ed] text-[#2f6d3d]' : transaction.settlementStatus === 'Customer Credit' ? 'bg-[#edf3ff] text-[#375b9d]' : 'bg-[#f1f1ef] text-[#625d54]'}`}>{transaction.settlementStatus}</span></td></tr>)}
            {!apiLoading && activeReturnRows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#77736d]">{activeTab === 'product-returns' ? 'No product returns match this date range and search.' : 'No credit returns match this date range and search.'}</td></tr>}
          </tbody></table></div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee8df] bg-[#f8f7f4] px-4 py-3"><span className="text-xs text-[#6b665c]">Showing <strong className="text-[#272727]">{transactionRange.start}-{transactionRange.end}</strong> of <strong className="text-[#272727]">{activeReturnRows.length}</strong> records</span><PaginationControls totalRecords={activeReturnRows.length} page={safeTransactionPage} pageSize={pageSize} onPageChange={setTransactionPage} /></footer>
        </motion.section>
      )}
      </AnimatePresence>
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTransaction(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="transaction-history-detail-title" className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#eee8df] bg-white px-5 py-4">
              <div><h2 id="transaction-history-detail-title" className="text-lg font-bold text-[#272727]">{selectedTransaction.transactionType} details</h2><p className="mt-1 text-sm text-[#77736d]">{selectedTransaction.invoiceNumber} · {selectedTransaction.customer}</p></div>
              <button type="button" aria-label="Close transaction details" onClick={() => setSelectedTransaction(null)} className="rounded-lg p-2 text-[#68645e] hover:bg-[#f6f5f2]"><X size={18} /></button>
            </header>
            <div className="space-y-4 p-5">
              <dl className="grid gap-3 rounded-xl bg-[#f8f7f4] p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Date &amp; time</dt><dd className="mt-1 font-medium text-[#272727]">{formatSaleDateTime(selectedTransaction.date)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Amount</dt><dd className="mt-1 font-bold text-[#272727]">{formatCurrency(selectedTransaction.amount)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Reason</dt><dd className="mt-1 text-[#272727]">{selectedTransaction.reason || '—'}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Settlement status</dt><dd className="mt-1 font-semibold text-[#765000]">{selectedTransaction.settlementStatus}</dd></div>{selectedTransaction.staff && <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Recorded by</dt><dd className="mt-1 text-[#272727]">{selectedTransaction.staff}</dd></div>}</dl>
              {Array.from(new Set(selectedTransaction.details.map((detail) => detail.group))).map((group) => (
                <section key={group}>
                  <h3 className="mb-2 text-sm font-bold text-[#272727]">{group}</h3>
                  <div className="divide-y divide-[#efede8] rounded-xl border border-[#eee8df]">
                    {selectedTransaction.details.filter((detail) => detail.group === group).map((detail) => <div key={detail.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><div><span className="font-medium text-[#272727]">{detail.label}{detail.method ? ` · ${detail.method}` : ''}</span>{detail.reference && <span className="ml-2 text-xs text-[#77736d]">Ref: {detail.reference}</span>}{detail.date && <span className="ml-2 text-xs text-[#77736d]">{formatSaleDateTime(detail.date)}</span>}</div><strong className="text-[#493819]">{detail.amount > 0 ? formatCurrency(detail.amount) : '—'}</strong></div>)}
                  </div>
                </section>
              ))}
            </div>
            <footer className="flex justify-end border-t border-[#eee8df] px-5 py-4"><button type="button" onClick={() => setSelectedTransaction(null)} className="h-10 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] hover:bg-[#ffdc82]">Close</button></footer>
          </section>
        </div>
      )}

      {(invoiceLoading || (invoiceDetail && !returnDetailsOnly)) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-2 sm:p-3" onClick={() => { if (!savingReturn && !savingPendingSettlement) { setInvoiceDetail(null); setReturnDetailsOnly(false); } }}>
          <section role="dialog" aria-modal="true" aria-labelledby="sales-return-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            {invoiceLoading || !invoiceDetail ? (
              <div className="flex h-56 items-center justify-center"><LoaderOne /></div>
            ) : <>
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eee8df] bg-white px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 id="sales-return-title" className="text-xl font-bold tracking-tight text-[#171717] sm:text-2xl">Sales Return</h2>
                  <p className="mt-0.5 text-xs text-[#5e5b56] sm:text-sm">Invoice {invoiceDetail.invoiceNumber} <span className="mx-1 text-[#b5aea2]">·</span> {invoiceDetail.customer?.name || 'Walk-in customer'} <span className="mx-1 text-[#b5aea2]">·</span> {reportDate(String(invoiceDetail.billDate).slice(0, 10))}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${invoiceDetail.returnStatus === 'FULLY_RETURNED' ? 'bg-[#FEE2E2] text-[#991B1B]' : invoiceDetail.returnStatus === 'PARTIALLY_RETURNED' ? 'bg-[#FFEDD5] text-[#9A3412]' : 'bg-[#fff1d0] text-[#765000]'}`}>{invoiceDetail.returnStatus === 'FULLY_RETURNED' ? 'Fully returned' : invoiceDetail.returnStatus === 'PARTIALLY_RETURNED' ? 'Partially returned' : 'Original invoice preserved'}</span>
                </div>
                <button type="button" aria-label="Close sales return" disabled={savingReturn || savingPendingSettlement} onClick={() => { setInvoiceDetail(null); setReturnDetailsOnly(false); }} className="shrink-0 rounded-lg p-1.5 text-[#68645e] hover:bg-[#f6f5f2] disabled:opacity-50"><X size={18} /></button>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
                <section>
                  <div className="mb-2 flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffedc2] text-xs font-bold text-[#684400]">1</span><h3 className="text-sm font-bold text-[#171717]">Select products to return</h3></div>
                  <div className="overflow-x-auto rounded-lg border border-[#e8e4dd]"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#f6f5f3] text-[10px] font-semibold uppercase tracking-wide text-[#5d5a55]"><tr><th className="px-3 py-2">Product</th><th className="px-2 py-2 text-right">Selling price</th><th className="px-2 py-2 text-right">Sold</th><th className="px-2 py-2 text-right">Returned</th><th className="px-2 py-2 text-right">Remaining</th><th className="px-2 py-2 text-right">Return Qty</th><th className="px-3 py-2 text-right">Line Value</th></tr></thead><tbody className="divide-y divide-[#eeeae4]">
                    {returnProductGroups.map((group) => {
                      const unit = group.lines[0]?.item.displayUnitSymbol || group.lines[0]?.item.displayUnitName || group.lines[0]?.item.unitSymbol || group.lines[0]?.item.unitName || 'units';
                      const isExpanded = Boolean(expandedReturnGroups[group.key]);
                      const singleLine = group.lines.length === 1 ? group.lines[0] : null;
                      const mrpText = (item: ApiSaleReturnDetail['items'][number]) => item.historicalMrpSnapshot == null ? 'Unavailable' : formatCurrency(Number(item.historicalMrpSnapshot));
                      const costText = (item: ApiSaleReturnDetail['items'][number]) => item.historicalCostSnapshot == null ? 'Unavailable' : formatCurrency(Number(item.historicalCostSnapshot));
                      const renderReturnInput = (line: typeof group.lines[number]) => <NumericTextInput min="0" max={line.remaining} maxDecimals={line.item.displayQuantity != null ? 0 : line.item.unitAllowsDecimals ? 3 : 0} value={returnQuantities[line.item.id] || ''} onValueChange={(value) => setReturnQuantities((previous) => ({ ...previous, [line.item.id]: value }))} disabled={line.remaining <= 0 || savingReturn} className="h-8 w-24 rounded-md border border-[#e1d9cb] bg-white px-2 text-right text-sm font-medium text-[#171717] outline-none focus:border-[#c58a00] disabled:bg-[#f5f4f2] disabled:text-[#a5a19a]" aria-label={`Return quantity for ${line.item.productName}, original line ${group.lines.indexOf(line) + 1}`} />;
                      return <React.Fragment key={group.key}>
                        <tr className="bg-white">
                          <td className="px-3 py-2 font-semibold text-[#171717]">
                            {group.lines.length > 1 ? <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedReturnGroups((previous) => ({ ...previous, [group.key]: !previous[group.key] }))} className="inline-flex items-center gap-1.5 text-left hover:text-[#8f5f00]"><ChevronDown size={14} className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" /><span>{group.productName}<span className="ml-2 text-[10px] font-medium text-[#77736d]">{group.lines.length} original lines</span></span></button> : <><span>{group.productName}</span><span className="mt-1 block text-[10px] font-medium text-[#68645e]">MRP {mrpText(singleLine!.item)}{canViewReturnCost ? ` · Purchase rate ${costText(singleLine!.item)}` : ''}</span></>}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-[#282828]">{formatCurrency(group.sellingPrice)}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-[#282828]">{group.sold.toLocaleString('en-IN')} {unit}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-[#282828]">{group.returned.toLocaleString('en-IN')} {unit}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-[#282828]">{group.remaining.toLocaleString('en-IN')} {unit}</td>
                          <td className="px-2 py-1.5 text-right">{singleLine ? renderReturnInput(singleLine) : <span className="font-semibold text-[#282828]">{group.requested.toLocaleString('en-IN')} {unit}</span>}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-[#171717]">{formatCurrency(group.amount)}</td>
                        </tr>
                        {group.lines.length > 1 && isExpanded && <tr className="bg-[#fbfaf7]"><td colSpan={7} className="px-3 py-2"><div className="overflow-x-auto rounded-md border border-[#e8e4dd] bg-white"><table className="w-full min-w-[720px] text-left text-[11px]"><thead className="bg-[#f6f5f3] uppercase tracking-wide text-[#68645e]"><tr><th className="px-2 py-2">Original sale line</th><th className="px-2 py-2">Historical MRP</th>{canViewReturnCost && <th className="px-2 py-2">Purchase rate</th>}<th className="px-2 py-2 text-right">Sold</th><th className="px-2 py-2 text-right">Returned</th><th className="px-2 py-2 text-right">Remaining</th><th className="px-2 py-2 text-right">Return Qty</th><th className="px-2 py-2 text-right">Value</th></tr></thead><tbody className="divide-y divide-[#eeeae4]">{group.lines.map((line, index) => {
                          const lineUnit = line.item.displayUnitSymbol || line.item.displayUnitName || line.item.unitSymbol || line.item.unitName || 'units';
                          return <tr key={line.item.id}><td className="px-2 py-2 font-medium text-[#272727]">Line {index + 1}</td><td className="px-2 py-2 font-semibold text-[#765000]">{mrpText(line.item)}</td>{canViewReturnCost && <td className="px-2 py-2 text-[#4e4b46]">{costText(line.item)}</td>}<td className="whitespace-nowrap px-2 py-2 text-right">{line.sold.toLocaleString('en-IN')} {lineUnit}</td><td className="whitespace-nowrap px-2 py-2 text-right">{line.returned.toLocaleString('en-IN')} {lineUnit}</td><td className="whitespace-nowrap px-2 py-2 text-right">{line.remaining.toLocaleString('en-IN')} {lineUnit}</td><td className="px-2 py-1.5 text-right">{renderReturnInput(line)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-semibold">{formatCurrency(line.amount)}</td></tr>;
                        })}</tbody></table></div></td></tr>}
                      </React.Fragment>;
                    })}
                  </tbody></table></div>
                </section>

                <section className="grid gap-3 border-y border-[#eee8df] py-3 lg:grid-cols-2 lg:gap-4">
                  <div className="space-y-2 lg:border-r lg:border-[#eee8df] lg:pr-4">
                    <div className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffedc2] text-xs font-bold text-[#684400]">2</span><h3 className="text-sm font-bold text-[#171717]">Return reason <span className="ml-1 text-xs font-medium text-[#6a665f]">Required</span></h3></div>
                    <div className="flex flex-wrap gap-1.5" aria-label="Quick return reasons">{SALES_RETURN_REASON_PRESETS.filter((preset) => preset !== 'Other').map((preset) => <button key={preset} type="button" disabled={savingReturn} aria-pressed={returnReasonPreset === preset} onClick={() => { setReturnReasonPreset(preset); setReturnReason(preset); }} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${returnReasonPreset === preset ? 'border-[#c58a00] bg-[#fff3d3] text-[#684400]' : 'border-[#e5e1da] bg-white text-[#35322e] hover:border-[#c58a00] hover:bg-[#fffaf0]'}`}>{preset}{returnReasonPreset === preset && <span className="ml-1 font-bold">✓</span>}</button>)}</div>
                    <label className="block text-xs font-medium text-[#35322e]">Reason details <span className="text-[#a65d00">*</span><textarea aria-label="Return reason" required maxLength={1000} value={returnReason} onChange={(event) => handleReturnReasonChange(event.target.value)} rows={2} disabled={savingReturn} className="mt-1 w-full rounded-lg border border-[#e5e1da] bg-[#f8f7f5] p-2 text-xs outline-none focus:border-[#c58a00]" placeholder="Choose a quick reason or enter another reason" /></label>
                    <label className="block text-xs font-medium text-[#35322e]">Additional notes <span className="font-normal text-[#77736d]">(optional)</span><textarea aria-label="Additional return notes" maxLength={Math.max(0, 1000 - returnReason.trim().length - 3)} value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} rows={2} disabled={savingReturn} className="mt-1 w-full rounded-lg border border-[#e5e1da] bg-[#f8f7f5] p-2 text-xs outline-none focus:border-[#c58a00]" placeholder="Add any useful details" /></label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffedc2] text-xs font-bold text-[#684400]">3</span><h3 className="text-sm font-bold text-[#171717]">Choose settlement</h3></div>
                    {[{ value: "REFUND" as const, label: "Refund Now", detail: "Record money paid back to the customer." }, { value: "CUSTOMER_CREDIT" as const, label: "Customer Credit", detail: `Add ${formatCurrency(returnPreview.settlementAmount)} to ${invoiceDetail.customer?.name || "the customer"} store credit.` }, { value: "PENDING" as const, label: "Refund Pending", detail: "Record an amount payable and settle it later." }].map((option) => <label key={option.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${returnSettlement === option.value ? "border-[#c58a00] bg-[#fff8e9]" : "border-[#e5e1da] bg-white hover:bg-[#fcfbf9]"}`}><input type="radio" name="sales-return-settlement" value={option.value} checked={returnSettlement === option.value} onChange={() => setReturnSettlement(option.value)} className="mt-0.5 h-3.5 w-3.5 accent-[#b47a00]" /><span><span className="block text-sm font-semibold text-[#171717]">{option.label}</span><span className="block text-xs text-[#5e5b56]">{option.detail}</span></span></label>)}
                    {returnSettlement === 'CUSTOMER_CREDIT' && <p className="text-xs text-[#77736d]">Available Store Credit: {formatCurrency(Number(invoiceDetail.customer?.availableStoreCredit || 0))}</p>}
                    {returnSettlement === 'REFUND' && returnPreview.settlementAmount > 0 && <div className="grid grid-cols-2 gap-2"><label className="flex flex-col gap-1 text-xs font-semibold text-[#68645e]">Refund method<select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as typeof refundMethod)} className="h-8 rounded-md border border-[#e8e4dd] bg-white px-2 text-xs"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="OTHER">Other</option></select></label><label className="flex flex-col gap-1 text-xs font-semibold text-[#68645e]">Reference (optional)<input value={refundReference} onChange={(event) => setRefundReference(event.target.value)} maxLength={120} className="h-8 rounded-md border border-[#e8e4dd] bg-white px-2 text-xs" /></label></div>}
                    <div className="rounded-lg bg-[#fff8e9] px-3 py-2 text-xs"><div className="flex justify-between text-[#5e5b56]"><span>Total return amount</span><strong className="text-[#171717]">{formatCurrency(returnPreview.amount)}</strong></div>{returnPreview.creditApplied > 0 && <div className="mt-1 flex justify-between text-xs text-[#6c665b]"><span>Applied to invoice balance</span><span>{formatCurrency(returnPreview.creditApplied)}</span></div>}<div className="mt-1 flex justify-between border-t border-[#eadfc8] pt-1.5 font-semibold text-[#684400]"><span>Amount to settle</span><strong>{formatCurrency(returnPreview.settlementAmount)}</strong></div></div>
                  </div>
                </section>

                {invoiceDetail.returns.length > 0 && <details className="rounded-lg border border-[#eee8df] bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#272727]">Return history ({invoiceDetail.returns.length})</summary><div className="space-y-1.5 border-t border-[#eee8df] p-2">{invoiceDetail.returns.map((salesReturn) => <div key={salesReturn.id} className="rounded-md border border-[#eee8df] p-2"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-[#272727]">{String(salesReturn.returnedAt).slice(0, 16).replace('T', ' ')} · {salesReturn.reason}</p><p className="mt-1 text-xs text-[#77736d]">{salesReturn.returnedBy?.name || 'Staff'} · {salesReturn.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</p></div><div className="text-right"><strong className="text-sm text-[#a86600]">{formatCurrency(Number(salesReturn.amount))}</strong><span className={`inline-flex items-center gap-1 text-[11px] ${Number(salesReturn.pendingRefundPayable) > 0 ? 'font-semibold text-[#765000]' : salesReturn.settlements.some((settlement) => settlement.type === 'CUSTOMER_CREDIT' || settlement.type === 'REFUND') ? 'font-semibold text-[#2f6d3d]' : 'text-[#77736d]'}`}>{Number(salesReturn.pendingRefundPayable) <= 0 && salesReturn.settlements.some((settlement) => settlement.type === 'CUSTOMER_CREDIT' || settlement.type === 'REFUND') && <Check size={12} aria-hidden="true" />}{Number(salesReturn.pendingRefundPayable) > 0 ? 'Refund pending' : salesReturn.settlements.some((settlement) => settlement.type === 'CUSTOMER_CREDIT') ? 'Credit issued' : salesReturn.settlements.some((settlement) => settlement.type === 'REFUND') ? 'Refund completed' : salesReturn.settlementType === 'BALANCE_OFFSET' ? 'Applied to invoice balance' : 'Settlement not recorded'}</span></div></div>{Number(salesReturn.pendingRefundPayable) > 0 && <div className="mt-3 border-t border-[#eee8df] pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#8b4b25]">Pending payable {formatCurrency(Number(salesReturn.pendingRefundPayable))}</span><button type="button" onClick={() => { setPendingSettlementId(salesReturn.id); setPendingSettlementAmount(String(Number(salesReturn.pendingRefundPayable))); }} className="rounded-lg border border-[#eadfc8] px-3 py-1.5 text-xs font-semibold text-[#765000] hover:bg-[#fffaf0]">Settle pending</button></div>{pendingSettlementId === salesReturn.id && <div className="mt-3 grid gap-2 sm:grid-cols-4"><input type="number" min="0.01" max={Number(salesReturn.pendingRefundPayable)} step="0.01" value={pendingSettlementAmount} onChange={(event) => setPendingSettlementAmount(event.target.value)} aria-label="Amount to settle" className="h-9 rounded-lg border border-[#e8e4dd] px-2 text-sm" /><select value={pendingSettlementMethod} onChange={(event) => setPendingSettlementMethod(event.target.value as typeof pendingSettlementMethod)} aria-label="Settlement method" className="h-9 rounded-lg border border-[#e8e4dd] bg-white px-2 text-sm"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="OTHER">Other</option></select><input value={pendingSettlementReference} onChange={(event) => setPendingSettlementReference(event.target.value)} placeholder="Reference (optional)" maxLength={120} className="h-9 rounded-lg border border-[#e8e4dd] px-2 text-sm" /><button type="button" disabled={savingPendingSettlement || !Number(pendingSettlementAmount)} onClick={() => void settlePendingRefund(salesReturn.id)} className="h-9 rounded-lg bg-[#ffe4a0] px-3 text-sm font-semibold text-[#493819] disabled:opacity-50">{savingPendingSettlement ? 'Saving…' : 'Record settlement'}</button></div>}</div>}</div>)}</div></details>}
              </div>

              <footer className="flex shrink-0 flex-col gap-2 border-t border-[#eee8df] bg-white px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg bg-[#fff7e5] px-3 py-2 sm:max-w-[48%]"><span className="text-xs font-semibold text-[#272727]">Total return amount</span><strong className="text-lg font-bold text-[#9a6200]">{formatCurrency(returnPreview.amount)}</strong></div>
                <div className="flex shrink-0 justify-end gap-2"><button type="button" disabled={savingReturn || savingPendingSettlement} onClick={() => { setInvoiceDetail(null); setReturnDetailsOnly(false); }} className="h-9 rounded-lg border border-[#e1dcd4] px-3 text-xs font-semibold text-[#4e4b46] hover:bg-[#f8f7f4] disabled:opacity-50">Cancel</button><button type="button" disabled={savingReturn || !returnReason.trim() || !returnPreview.items.length} onClick={() => setConfirmReturnOpen(true)} className="h-9 rounded-lg bg-[#b77700] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#965f00] disabled:cursor-not-allowed disabled:opacity-50">Confirm Sales Return</button></div>
              </footer>

              {confirmReturnOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={() => !savingReturn && setConfirmReturnOpen(false)}><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-sales-return-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h3 id="confirm-sales-return-title" className="text-lg font-bold text-[#272727]">Confirm sales return</h3><p className="mt-2 text-sm text-[#68645e]">Return these {returnPreview.items.length} product line(s) for <strong className="text-[#272727]">{formatCurrency(returnPreview.amount)}</strong>?</p><div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-[#eee8df] p-3">{returnPreview.items.map((item) => <div key={item.saleItemId} className="flex items-start justify-between gap-3 text-sm"><span className="font-medium text-[#272727]">{item.productName}<span className="ml-2 text-[#77736d]">× {item.displayQuantity.toLocaleString('en-IN')} {item.unitLabel}</span></span><strong className="shrink-0 text-[#493819]">{formatCurrency(item.amount)}</strong></div>)}</div><div className="mt-3 rounded-xl bg-[#fffaf0] p-3 text-sm"><p className="font-semibold text-[#493819]">{returnPreview.settlementAmount <= 0 ? 'Applied to invoice balance' : returnSettlement === 'REFUND' ? `Refund ${formatCurrency(returnPreview.settlementAmount)} now` : returnSettlement === 'CUSTOMER_CREDIT' ? `Add ${formatCurrency(returnPreview.settlementAmount)} to customer credit` : `${formatCurrency(returnPreview.settlementAmount)} refund pending`}</p><p className="mt-1 text-[#77736d]">Reason: {returnReason.trim()}{returnNotes.trim() ? ` · ${returnNotes.trim()}` : ''}</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={savingReturn} onClick={() => setConfirmReturnOpen(false)} className="h-10 rounded-lg border border-[#e8e4dd] px-4 text-sm font-semibold text-[#625d54] hover:bg-[#f8f7f4] disabled:opacity-50">Go back</button><button type="button" disabled={savingReturn} onClick={() => void submitSalesReturn()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#b77700] px-4 text-sm font-bold text-white hover:bg-[#965f00] disabled:opacity-50">{savingReturn && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{savingReturn ? 'Returning...' : 'Confirm return'}</button></div></section></div>}
            </>}
          </section>
        </div>
      )}
      {invoiceDetail && returnDetailsOnly && !invoiceLoading && (() => {
        const invoiceFullyReturned = invoiceDetail.items.length > 0 && invoiceDetail.items.every((item) => Number(item.remainingQuantity) <= 0.0000001);
        return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) { setInvoiceDetail(null); setReturnDetailsOnly(false); } }}>
          <section role="dialog" aria-modal="true" aria-labelledby="return-details-title" className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eee8df] px-4 py-3 sm:px-5">
              <div><h2 id="return-details-title" className="text-lg font-bold text-[#272727]">Return details</h2><p className="mt-1 text-xs text-[#77736d]">Invoice {invoiceDetail.invoiceNumber} · {invoiceDetail.customer?.name || 'Walk-in customer'}</p>{invoiceFullyReturned && <span className="mt-2 inline-flex rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#991B1B]">All products fully returned</span>}</div>
              <button type="button" aria-label="Close return details" onClick={() => { setInvoiceDetail(null); setReturnDetailsOnly(false); }} className="rounded-lg p-1.5 text-[#68645e] hover:bg-[#f6f5f2]"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <section><h3 className="mb-2 text-sm font-bold text-[#272727]">Returned products</h3><div className="divide-y divide-[#efede8] rounded-lg border border-[#eee8df]">
                {invoiceDetail.items.filter((item) => Number(item.returnedQuantity) > 0).map((item) => {
                  const fullyReturned = Number(item.remainingQuantity) <= 0.0000001;
                  const soldQuantity = item.displayQuantity != null ? Number(item.displayQuantity) : Number(item.quantity);
                  const returnedQuantity = item.displayQuantity != null ? Number(item.returnedDisplayQuantity || 0) : Number(item.returnedQuantity);
                  return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><div><p className="text-sm font-semibold text-[#272727]">{item.productName}</p><p className="text-xs text-[#77736d]">Returned {returnedQuantity.toLocaleString('en-IN')} of {soldQuantity.toLocaleString('en-IN')} {item.displayUnitSymbol || item.unitSymbol || item.unitName}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fullyReturned ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#FFEDD5] text-[#9A3412]'}`}>{fullyReturned ? 'Fully returned' : 'Partially returned'}</span></div>;
                })}
              </div></section>
              <section><h3 className="mb-2 text-sm font-bold text-[#272727]">Return and settlement history</h3><div className="space-y-2">
                {invoiceDetail.returns.map((salesReturn) => {
                  const refundSettlements = salesReturn.settlements.filter((settlement) => settlement.type === 'REFUND');
                  const customerCredits = salesReturn.settlements.filter((settlement) => settlement.type === 'CUSTOMER_CREDIT');
                  const pendingAmount = Number(salesReturn.pendingRefundPayable) || 0;
                  return <article key={salesReturn.id} className="rounded-lg border border-[#eee8df] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-[#272727]">{String(salesReturn.returnedAt).slice(0, 16).replace('T', ' ')} · {salesReturn.reason}</p><p className="mt-1 text-xs text-[#77736d]">{salesReturn.returnedBy?.name || 'Staff'} · {salesReturn.items.map((item) => `${item.productName} × ${Number(item.quantity).toLocaleString('en-IN')}`).join(', ')}</p></div><strong className="text-sm text-[#493819]">{formatCurrency(Number(salesReturn.amount))}</strong></div>
                    {Number(salesReturn.creditAppliedAmount) > 0 && <p className="mt-2 text-xs text-[#375b9d]">Applied to invoice balance: {formatCurrency(Number(salesReturn.creditAppliedAmount))}</p>}
                    {customerCredits.map((settlement) => <p key={settlement.id} className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#eaf5ed] px-2.5 py-2 text-xs font-semibold text-[#2f6d3d]"><Check size={13} aria-hidden="true" />Credit issued: {formatCurrency(Number(settlement.amount))} · {formatSaleDateTime(settlement.createdAt)}</p>)}
                    {refundSettlements.map((settlement) => <div key={settlement.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#eaf5ed] px-2.5 py-2 text-xs text-[#2f6d3d]"><span><strong className="inline-flex items-center gap-1"><Check size={13} aria-hidden="true" />Refund completed · {settlement.method || 'Payment'}</strong>{settlement.reference && <span> · Ref: {settlement.reference}</span>}<span> · {formatSaleDateTime(settlement.createdAt)}</span></span><strong>{formatCurrency(Number(settlement.amount))}</strong></div>)}
                    {pendingAmount > 0 && <p className="mt-2 rounded-md bg-[#fff5d9] px-2.5 py-2 text-xs font-semibold text-[#765000]">Refund pending: {formatCurrency(pendingAmount)}</p>}
                  </article>;
                })}
              </div></section>
            </div>
            <footer className="flex justify-end border-t border-[#eee8df] px-4 py-3 sm:px-5"><button type="button" onClick={() => { setInvoiceDetail(null); setReturnDetailsOnly(false); }} className="h-9 rounded-lg border border-[#e1dcd4] px-4 text-sm font-semibold text-[#4e4b46] hover:bg-[#f8f7f4]">Close</button></footer>
          </section>
        </div>;
      })()}
      <article className="daily-register-print-only" aria-label="Printable daily register">
        <div className="register-print-heading">
          <div>
            <p className="register-print-brand">ABLE LUBES</p>
            <h1>{activeTab === 'sales' ? 'Daily Sales Register' : activeTab === 'expenses' ? 'Daily Expenses Register' : activeTab === 'product-returns' ? 'Product Returns' : 'Credit Returns'}</h1>
            <p>{activeTab === 'sales' ? 'Sales report' : activeTab === 'expenses' ? 'Expense report' : activeTab === 'product-returns' ? 'Sales return report' : 'Billing credit cancellation report'}</p>
          </div>
          <div className="register-print-meta">
            <strong>Period</strong><span>{reportDate(fromDate)} to {reportDate(toDate)}</span>
          </div>
        </div>

        {activeTab === 'sales' ? <div className="register-print-totals">
          <div><span>Total sales</span><strong>{formatCurrency(printSalesTotal)}</strong></div>
        </div> : activeTab === 'expenses' ? <div className="register-print-totals">
          <div><span>Total expenses</span><strong>{formatCurrency(printExpensesTotal)}</strong></div>
        </div> : <div className="register-print-totals"><div><span>{activeTab === 'product-returns' ? 'Product returns' : 'Credit returns'}</span><strong>{activeReturnRows.length} records</strong></div></div>}

        {activeTab === 'sales' ? <section className="register-print-section">
          <h2>Sales <span>({filteredSales.length})</span></h2>
          <table className="register-print-sales">
            <thead><tr><th>Date &amp; time</th><th>Bill number</th><th>Product name</th><th>Payment received (₹)</th><th>Net sales (₹)</th><th>Bill total (₹)</th><th>Discount given (₹)</th><th>Payment mode</th></tr></thead>
            <tbody>
              {filteredSales.map((sale) => <tr key={sale.id}>
                <td>{formatSaleDateTime(sale.dateTime)}</td><td>{sale.billNumber}</td><td style={{ whiteSpace: 'pre-line' }}>{sale.itemsList}</td><td>{formatCurrency(sale.amount)}</td><td>{formatCurrency(sale.netSalesAmount ?? sale.billTotal ?? 0)}</td><td>{sale.paymentMode.includes('Credit settlement') && sale.billTotal !== undefined ? formatCurrency(sale.billTotal) : '—'}</td><td>{(sale.discountAmount || 0) > 0 ? formatCurrency(sale.discountAmount || 0) : '—'}</td><td>{sale.paymentMode}</td>
              </tr>)}
              {filteredSales.length === 0 && <tr><td colSpan={8} className="register-print-empty">No sales in this range.</td></tr>}
              {filteredSales.length > 0 && <tr><td colSpan={3}><strong>Grand total</strong></td><td><strong>{formatCurrency(printPaymentsTotal)}</strong></td><td><strong>{formatCurrency(printSalesTotal)}</strong></td><td /><td /><td /></tr>}
            </tbody>
          </table>
        </section> : activeTab === 'expenses' ? <section className="register-print-section">
          <h2>Expenses <span>({matchingExpenses.length})</span></h2>
          <table className="register-print-expenses">
            <thead><tr><th>Date</th><th>Description</th><th>Category / payment / notes</th><th>Amount (₹)</th></tr></thead>
            <tbody>
              {matchingExpenses.map((expense) => <tr key={expense.id}>
                <td>{expense.date}</td><td>{expense.description}</td><td>{[expense.category, expense.paymentMethod, expense.notes].filter(Boolean).join(' · ') || '—'}</td><td>{formatCurrency(expense.amount)}</td>
              </tr>)}
              {matchingExpenses.length === 0 && <tr><td colSpan={4} className="register-print-empty">No expenses in this range.</td></tr>}
            </tbody>
          </table>
        </section> : <section className="register-print-section">
          <h2>{activeTab === 'product-returns' ? 'Product Returns' : 'Credit Returns'} <span>({activeReturnRows.length})</span></h2>
          <table className="register-print-sales">
            <thead><tr><th>Date &amp; time</th><th>Invoice</th><th>Customer</th><th>Reason</th><th>Amount (₹)</th><th>Settlement status</th></tr></thead>
            <tbody>{activeReturnRows.map((transaction) => <tr key={transaction.id}><td>{formatSaleDateTime(transaction.date)}</td><td>{transaction.invoiceNumber}</td><td>{transaction.customer}</td><td>{transaction.reason || '—'}</td><td>{formatCurrency(transaction.amount)}</td><td>{transaction.settlementStatus}</td></tr>)}{activeReturnRows.length === 0 && <tr><td colSpan={6} className="register-print-empty">No records in this range.</td></tr>}</tbody>
          </table>
        </section>}
      </article>
    </div>
  );
};
