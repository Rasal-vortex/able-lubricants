import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle, Trash2, RotateCcw, Plus, X, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CreditBill, PurchaseBill } from '../types';
import { formatCurrency } from '../utils/currency';
import LoaderOne from '../components/ui/loader-one';
import { DEFAULT_PAGE_SIZE, getPageRecords, getPaginationRange, PaginationControls } from '../components/PaginationControls';

export const CreditBillManagementView: React.FC = () => {
  const {
    creditBills,
    creditBillLoading,
    creditBillError,
    addCreditBill,
    deleteCreditBill,
    cancelCreditBillSale,
    settleCreditBillRefund,
    collectCreditPayment,
    showToast,
    customers,
    addCustomer,
    purchases,
    suppliers,
    supplierLedger,
    recordSupplierPayment,
  } = useApp();

  const [creditView, setCreditView] = useState<'customers' | 'suppliers'>('customers');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Overdue' | 'Partial' | 'Unpaid' | 'Paid' | 'Cancelled'>('All');
  const [customerPage, setCustomerPage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);

  // Record Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingCreditBill, setSavingCreditBill] = useState(false);
  const [newBillDate, setNewBillDate] = useState(localToday);
  const [newBillNumber, setNewBillNumber] = useState(() => `CR-${Date.now().toString().slice(-7)}`);
  const [selectedParty, setSelectedParty] = useState(customers[0]?.name || '');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => { const due = new Date(); due.setDate(due.getDate() + 14); return new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
  const [newCreditTerm, setNewCreditTerm] = useState('Due on agreed date');
  const [newRemarks, setNewRemarks] = useState('');

  // Inline Pay modal
  const [payModalBill, setPayModalBill] = useState<CreditBill | null>(null);
  const [postingPayment, setPostingPayment] = useState(false);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [deleteModalBill, setDeleteModalBill] = useState<CreditBill | null>(null);
  const [deletingCreditBill, setDeletingCreditBill] = useState(false);
  const deleteCreditBillInFlight = useRef(false);
  const [cancelModalBill, setCancelModalBill] = useState<CreditBill | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [actualPaymentAmounts, setActualPaymentAmounts] = useState<Record<'CASH' | 'UPI' | 'BANK' | 'OTHER', string>>({ CASH: '0', UPI: '0', BANK: '0', OTHER: '0' });
  const [actualReceivedConfirmed, setActualReceivedConfirmed] = useState(false);
  const [paymentSectionOpen, setPaymentSectionOpen] = useState(false);
  const [refundMode, setRefundMode] = useState<'PENDING' | 'NOW'>('PENDING');
  const [refundLines, setRefundLines] = useState<Array<{ amount: string; method: 'CASH' | 'UPI' | 'BANK' | 'OTHER'; reference: string; originalPaymentId?: string }>>([]);
  const [savingCancellation, setSavingCancellation] = useState(false);
  const cancellationInFlight = useRef(false);
  const [refundModalBill, setRefundModalBill] = useState<CreditBill | null>(null);
  const [refundSettlementAmount, setRefundSettlementAmount] = useState('');
  const [refundSettlementMethod, setRefundSettlementMethod] = useState<'CASH' | 'UPI' | 'BANK' | 'OTHER'>('CASH');
  const [refundSettlementReference, setRefundSettlementReference] = useState('');
  const [refundSettlementOriginalPaymentId, setRefundSettlementOriginalPaymentId] = useState('');
  const [savingRefundSettlement, setSavingRefundSettlement] = useState(false);
  const refundSettlementIdempotencyKey = useRef<string | null>(null);
  const [supplierPayPurchase, setSupplierPayPurchase] = useState<PurchaseBill | null>(null);
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [supplierPayDate, setSupplierPayDate] = useState(localToday);
  const [supplierPayMethod, setSupplierPayMethod] = useState<'Cash' | 'UPI' | 'Bank transfer' | 'Cheque'>('Cash');
  const [savingSupplierPayment, setSavingSupplierPayment] = useState(false);

  // Party balances lookup
  const priorDue = creditBills.filter((bill) => bill.partyName === selectedParty && bill.netDue > 0).reduce((sum, bill) => sum + bill.netDue, 0);
  const currentAmt = parseFloat(newBillAmount) || 0;
  const expectedBalance = priorDue + currentAmt;
  const cancellationPaymentMethods = ['CASH', 'UPI', 'BANK', 'OTHER'] as const;
  const actualReceivedAmount = cancellationPaymentMethods.reduce((total, method) => total + (Number(actualPaymentAmounts[method]) || 0), 0);
  const recordedCollectedAmount = (cancelModalBill?.payments || []).reduce((total, payment) => payment.method === 'CASH' || payment.method === 'UPI' ? total + Number(payment.amount || 0) : total, 0);
  const recordedStoreCreditAmount = (cancelModalBill?.payments || []).reduce((total, payment) => payment.method === 'STORE_CREDIT' ? total + Number(payment.amount || 0) : total, 0);
  const hasRecordedPayments = recordedCollectedAmount > 0;

  // Filter customer credit bills.
  const filteredBills = creditBills.filter((bill) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      bill.partyName.toLowerCase().includes(q) ||
      bill.billNumber.toLowerCase().includes(q) ||
      bill.gstin.toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'Overdue') matchesStatus = bill.status === 'Overdue';
    if (statusFilter === 'Partial') matchesStatus = bill.status === 'Partially Paid';
    if (statusFilter === 'Unpaid') matchesStatus = bill.status === 'Unpaid';
    if (statusFilter === 'Paid') matchesStatus = bill.status === 'Settled';
    if (statusFilter === 'Cancelled') matchesStatus = bill.status === 'Cancelled';

    const parsedDate = new Date(bill.billDate);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(bill.billDate) ? bill.billDate : Number.isNaN(parsedDate.getTime()) ? bill.billDate : new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateMatch = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    const matchesParty = customerFilter === 'ALL' || bill.partyName === customerFilter;
    return matchesParty && matchesSearch && matchesStatus && dateMatch;
  });
  const grandTotalDue = filteredBills.reduce((total, bill) => total + bill.netDue, 0);
  const totalPendingRefunds = filteredBills.reduce((total, bill) => total + (bill.refundPayable || 0), 0);
  const customerPageCount = Math.max(1, Math.ceil(filteredBills.length / DEFAULT_PAGE_SIZE));
  const safeCustomerPage = Math.min(customerPage, customerPageCount);
  const pageBills = getPageRecords(filteredBills, safeCustomerPage);
  const customerRange = getPaginationRange(filteredBills.length, safeCustomerPage);

  const supplierPurchaseDue = (purchase: PurchaseBill) => Math.max(
    0,
    Number(purchase.outstandingBalance ?? (purchase.totalAmount - (purchase.amountPaid || 0))) || 0,
  );
  const supplierPurchases = purchases.filter((purchase) => {
    if (purchase.status === 'CANCELLED') return false;
    if (supplierFilter !== 'ALL' && purchase.partyName !== supplierFilter) return false;
    const due = supplierPurchaseDue(purchase);
    const paid = Number(purchase.amountPaid || 0);
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch = !query || purchase.partyName.toLowerCase().includes(query) || purchase.invoiceNumber.toLowerCase().includes(query);
    const date = String(purchase.invoiceDate || '').slice(0, 10);
    const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    const matchesStatus = statusFilter === 'All' ||
      (statusFilter === 'Unpaid' && due > 0 && paid <= 0) ||
      (statusFilter === 'Partial' && due > 0 && paid > 0) ||
      (statusFilter === 'Paid' && due <= 0);
    return matchesSearch && matchesDate && matchesStatus;
  });
  const supplierPageCount = Math.max(1, Math.ceil(supplierPurchases.length / DEFAULT_PAGE_SIZE));
  const safeSupplierPage = Math.min(supplierPage, supplierPageCount);
  const pageSupplierPurchases = getPageRecords(supplierPurchases, safeSupplierPage);
  const supplierRange = getPaginationRange(supplierPurchases.length, safeSupplierPage);
  useEffect(() => { setCustomerPage(1); }, [searchTerm, customerFilter, statusFilter, fromDate, toDate]);
  useEffect(() => { setSupplierPage(1); }, [searchTerm, supplierFilter, statusFilter, fromDate, toDate, creditView]);
  useEffect(() => { if (customerPage > customerPageCount) setCustomerPage(customerPageCount); }, [customerPage, customerPageCount]);
  useEffect(() => { if (supplierPage > supplierPageCount) setSupplierPage(supplierPageCount); }, [supplierPage, supplierPageCount]);
  const supplierTotals = supplierPurchases.reduce((totals, purchase) => ({
    billed: totals.billed + purchase.totalAmount,
    paid: totals.paid + (purchase.amountPaid || 0),
    due: totals.due + supplierPurchaseDue(purchase),
  }), { billed: 0, paid: 0, due: 0 });
  const supplierOptions = Array.from(new Set(purchases.filter((purchase) => purchase.status !== 'CANCELLED').map((purchase) => purchase.partyName))).sort((a, b) => a.localeCompare(b));
  const customerOptions = Array.from(new Set([...customers.map((customer) => customer.name), ...creditBills.map((bill) => bill.partyName)])).sort((a, b) => a.localeCompare(b));

  const handleSaveCreditBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingCreditBill) return;
    const amt = parseFloat(newBillAmount);
    if (!selectedParty || !newBillNumber.trim() || isNaN(amt) || amt <= 0) {
      showToast('Choose a customer and specify a valid bill number and amount.', 'error');
      return;
    }

    setSavingCreditBill(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const saved = await addCreditBill({
        billDate: newBillDate,
        billNumber: newBillNumber.trim(),
        partyName: selectedParty,
        customerId: customers.find((customer) => customer.name === selectedParty)?.id,
        gstin: '',
        term: newCreditTerm,
        status: 'Unpaid',
        priorBalance: priorDue,
        billAmount: amt,
        netDue: priorDue + amt,
        dueDate: newDueDate,
        remarks: newRemarks,
      });
      if (!saved) return;
      setDrawerOpen(false);
      setNewBillNumber(`CR-${Date.now().toString().slice(-7)}`);
    } finally {
      setSavingCreditBill(false);
    }
  };

  const handleOpenPayModal = (bill: CreditBill) => {
    setPayModalBill(bill);
    setPayAmountInput(bill.netDue.toString());
  };

  const handleConfirmPay = async () => {
    if (!payModalBill || postingPayment) return;
    const amt = parseFloat(payAmountInput);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    setPostingPayment(true);
    try {
      const saved = await collectCreditPayment(payModalBill.billNumber, amt, payMethod);
      if (saved) setPayModalBill(null);
    } finally {
      setPostingPayment(false);
    }
  };

  const handleConfirmDeleteCreditBill = async () => {
    if (!deleteModalBill || deleteCreditBillInFlight.current) return;
    deleteCreditBillInFlight.current = true;
    setDeletingCreditBill(true);
    try {
      const deleted = await deleteCreditBill(deleteModalBill.id);
      if (deleted) setDeleteModalBill(null);
    } finally {
      deleteCreditBillInFlight.current = false;
      setDeletingCreditBill(false);
    }
  };

  const openCancelSale = (bill: CreditBill) => {
    setCancelModalBill(bill);
    setCancellationReason('');
    setActualReceivedConfirmed(!(bill.payments || []).some((payment) => payment.method === 'CASH' || payment.method === 'UPI'));
    setPaymentSectionOpen(false);
    // Recorded receipts are evidence to review, not proof that the customer paid.
    // Start at zero and require staff to confirm or correct the actual received amount.
    setActualPaymentAmounts({ CASH: '0', UPI: '0', BANK: '0', OTHER: '0' });
    setRefundMode('PENDING');
    setRefundLines([{ amount: '', method: 'CASH', reference: '' }]);
  };

  const handleCancelSale = async () => {
    if (!cancelModalBill || cancellationInFlight.current) return;
    const reason = cancellationReason.trim();
    if (!reason) {
      showToast('Enter a reason for cancelling this sale.', 'error');
      return;
    }
    const invalidActualPayment = cancellationPaymentMethods.some((method) => {
      const amount = actualPaymentAmounts[method].trim() ? Number(actualPaymentAmounts[method]) : 0;
      return !Number.isFinite(amount) || amount < 0;
    });
    if (invalidActualPayment || actualReceivedAmount - recordedCollectedAmount > 0.005 || actualReceivedAmount - cancelModalBill.billAmount > 0.005) {
      showToast('Actual payment amounts must be valid and cannot exceed the recorded collection or sale total.', 'error');
      return;
    }
    const invalidRefundInput = refundLines.some((line) => line.amount.trim() && (!Number.isFinite(Number(line.amount)) || Number(line.amount) < 0));
    if (refundMode === 'NOW' && invalidRefundInput) {
      showToast('Refund amounts must be valid non-negative numbers.', 'error');
      return;
    }
    const actualPayments = cancellationPaymentMethods.map((method) => ({ amount: Number(actualPaymentAmounts[method]) || 0, method }));
    const refunds = (refundMode === 'NOW' && actualReceivedAmount > 0 ? refundLines : [])
      .map((line) => ({ amount: Number(line.amount), method: line.method, ...(line.reference.trim() ? { reference: line.reference.trim() } : {}), ...(line.originalPaymentId ? { originalPaymentId: line.originalPaymentId } : {}) }))
      .filter((line) => line.amount > 0 && Number.isFinite(line.amount));
    const refundTotal = refunds.reduce((sum, line) => sum + line.amount, 0);
    if (refundTotal - actualReceivedAmount > 0.005) {
      showToast('Refund total cannot exceed the amount actually received.', 'error');
      return;
    }
    cancellationInFlight.current = true;
    setSavingCancellation(true);
    try {
      if (refundMode === 'NOW' && actualReceivedAmount > 0 && refunds.length === 0) {
        showToast('Enter at least one amount being refunded now, or choose Refund pending.', 'error');
        return;
      }
      const success = await cancelCreditBillSale(cancelModalBill.id, reason, refundMode, actualPayments, refunds, actualReceivedConfirmed);
      if (success) setCancelModalBill(null);
    } finally {
      cancellationInFlight.current = false;
      setSavingCancellation(false);
    }
  };

  const openSettleRefund = (bill: CreditBill) => {
    setRefundModalBill(bill);
    setRefundSettlementAmount(Number(bill.refundPayable || 0).toFixed(2));
    setRefundSettlementMethod('CASH');
    setRefundSettlementReference('');
    setRefundSettlementOriginalPaymentId('');
    refundSettlementIdempotencyKey.current = crypto.randomUUID();
  };

  const handleSettleRefund = async () => {
    if (!refundModalBill || savingRefundSettlement) return;
    const amount = Number(refundSettlementAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(refundModalBill.refundPayable || 0)) {
      showToast('Enter a refund amount greater than zero and no more than the pending refund.', 'error');
      return;
    }
    setSavingRefundSettlement(true);
    try {
      const success = await settleCreditBillRefund(refundModalBill.id, amount, refundSettlementMethod, refundSettlementReference.trim() || undefined, refundSettlementIdempotencyKey.current || crypto.randomUUID(), refundSettlementOriginalPaymentId || undefined);
      if (success) setRefundModalBill(null);
    } finally {
      setSavingRefundSettlement(false);
    }
  };

  const openSupplierPayment = (purchase: PurchaseBill) => {
    const due = supplierPurchaseDue(purchase);
    if (!purchase.id || due <= 0) return;
    setSupplierPayPurchase(purchase);
    setSupplierPayAmount(due.toFixed(2).replace(/\.00$/, ''));
    setSupplierPayDate(localToday);
    setSupplierPayMethod('Cash');
  };

  const handleSupplierPayment = async () => {
    const purchase = supplierPayPurchase;
    const amount = Number(supplierPayAmount);
    const due = purchase ? supplierPurchaseDue(purchase) : 0;
    if (!purchase || !purchase.id || !Number.isFinite(amount) || amount <= 0 || amount > due || savingSupplierPayment) {
      showToast('Enter a payment greater than zero and no more than the invoice balance.', 'error');
      return;
    }
    setSavingSupplierPayment(true);
    try {
      const saved = await recordSupplierPayment(
        purchase.invoiceNumber,
        purchase.partyName,
        amount,
        supplierPayDate,
        supplierPayMethod,
        purchase.id,
        due,
        purchase.invoiceDate,
      );
      if (saved) setSupplierPayPurchase(null);
    } finally {
      setSavingSupplierPayment(false);
    }
  };

  const handlePrintStatement = (bill: CreditBill) => {
    const balanceDue = bill.billNumber.startsWith('CR-SB-')
      ? bill.netDue
      : Math.max(0, bill.netDue - bill.priorBalance);
    const escapeHtml = (value: string | number) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      showToast('Allow pop-ups to print the credit statement.', 'error');
      return;
    }

    const amountPaid = Math.max(0, bill.billAmount - balanceDue);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><title>Credit Bill ${escapeHtml(bill.billNumber)}</title>
      <style>
        @page { size: A4 portrait; margin: 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #171717; font: 10pt/1.45 Arial, Helvetica, sans-serif; }
        .brand { color: #9a6800; font-size: 17pt; font-weight: 800; letter-spacing: .04em; }
        .workspace { margin-top: 2px; color: #555; font-size: 9pt; }
        header { display: flex; justify-content: space-between; padding-bottom: 10mm; border-bottom: 1px solid #b8b8b8; }
        h1 { margin: 0; font-size: 19pt; }
        .title { margin: 10mm 0 7mm; text-align: center; }
        .title p { margin: 2mm 0 0; color: #666; font-size: 9pt; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 12mm; margin-bottom: 9mm; padding: 5mm; border: 1px solid #ddd; background: #fafafa; }
        .meta div, .terms { display: flex; justify-content: space-between; gap: 8mm; }
        .meta span:first-child, h2 { color: #666; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
        .meta span:last-child { font-weight: 600; text-align: right; }
        .customer { margin-bottom: 10mm; }
        h2 { margin: 0 0 2mm; }
        .customer strong { font-size: 13pt; }
        table { width: 100%; margin-bottom: 7mm; border-collapse: collapse; }
        th, td { padding: 4mm 3mm; border-bottom: 1px solid #ddd; text-align: left; }
        th:last-child, td:last-child { text-align: right; }
        thead th { border-bottom-color: #999; color: #555; font-size: 8pt; text-transform: uppercase; }
        tfoot th { border-top: 2px solid #777; border-bottom: 0; font-size: 12pt; }
        .terms { padding: 4mm 0; border-bottom: 1px solid #ddd; }
        .terms span { color: #666; }
        footer { margin-top: 16mm; color: #666; font-size: 8pt; }
        footer p { margin: 0 0 20mm; text-align: center; }
        .signatures { display: flex; justify-content: space-between; gap: 20mm; }
        .signatures span { width: 45%; padding-top: 3mm; border-top: 1px solid #777; text-align: center; }
      </style></head><body>
      <header><div><div class="brand">ABLE LUBES</div><div class="workspace">Store workspace</div></div></header>
      <div class="title"><h1>Credit Bill Statement</h1><p>Customer account statement</p></div>
      <section class="meta">
        <div><span>Bill number</span><span>${escapeHtml(bill.billNumber)}</span></div>
        <div><span>Bill date</span><span>${escapeHtml(bill.billDate)}</span></div>
        <div><span>Status</span><span>${escapeHtml(bill.status)}</span></div>
        <div><span>Due date</span><span>${escapeHtml(bill.dueDate || '—')}</span></div>
      </section>
      <section class="customer"><h2>Bill to</h2><strong>${escapeHtml(bill.partyName)}</strong></section>
      <table><thead><tr><th>Description</th><th>Amount (₹)</th></tr></thead>
        <tbody><tr><td>Bill amount</td><td>${escapeHtml(formatCurrency(bill.billAmount))}</td></tr>
        <tr><td>Amount paid</td><td>${escapeHtml(formatCurrency(amountPaid))}</td></tr></tbody>
        <tfoot><tr><th>Balance due</th><th>${escapeHtml(formatCurrency(balanceDue))}</th></tr></tfoot>
      </table>
      <div class="terms"><span>Credit terms</span><strong>${escapeHtml(bill.term || 'Due on agreed date')}</strong></div>
      <footer><p>This is a computer-generated credit statement.</p><div class="signatures"><span>Customer signature</span><span>Authorized signature</span></div></footer>
      </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.onafterprint = () => printWindow.close();
      printWindow.print();
    }, 250);
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Filter & Search Controls Bar */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-md mb-space-md shadow-sm border border-outline-variant/20">
        <div className="grid grid-cols-1 gap-3 items-center xl:grid-cols-[minmax(160px,.9fr)_minmax(180px,1fr)_minmax(240px,1.2fr)_minmax(135px,.7fr)_auto]">
          {/* Search Input */}
          <div className="relative min-w-0">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
              placeholder={creditView === 'customers' ? 'Search customer or bill number…' : 'Search supplier or purchase invoice…'}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <label className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant" htmlFor="credit-party-filter">
            <span>{creditView === 'customers' ? 'Customer' : 'Supplier'}</span>
            <select id="credit-party-filter" value={creditView === 'customers' ? customerFilter : supplierFilter} onChange={(event) => creditView === 'customers' ? setCustomerFilter(event.target.value) : setSupplierFilter(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant/25 bg-surface-container-low px-3 text-sm font-medium text-on-surface outline-none focus:border-primary">
              <option value="ALL">All {creditView === 'customers' ? 'customers' : 'suppliers'}</option>
              {(creditView === 'customers' ? customerOptions : supplierOptions).map((partyName) => <option key={partyName} value={partyName}>{partyName}</option>)}
            </select>
          </label>

          {/* Date Range */}
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[#efdcae] bg-[#fff7e7] p-1.5">
            <div className="relative min-w-0 flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[15px]">
                calendar_today
              </span>
              <input
                className="w-full h-9 pl-8 pr-2 rounded-md bg-[#fffdf8] font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none focus:bg-white transition-colors border border-[#ead8ad]"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <span className="shrink-0 text-[#89795c] font-label-sm text-label-sm">to</span>
            <div className="relative min-w-0 flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[15px]">
                event
              </span>
              <input
                className="w-full h-9 pl-8 pr-2 rounded-md bg-[#fffdf8] font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none focus:bg-white transition-colors border border-[#ead8ad]"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Status dropdown */}
          <label className="flex min-w-0 items-center gap-2 text-sm text-on-surface-variant" htmlFor="credit-bill-status-filter">
            <span>Status</span>
            <select
              id="credit-bill-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant/25 bg-surface-container-low px-3 text-sm font-medium text-on-surface outline-none focus:border-primary"
            >
              {(creditView === 'customers' ? ['All', 'Overdue', 'Partial', 'Unpaid', 'Paid', 'Cancelled'] : ['All', 'Partial', 'Unpaid', 'Paid']).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>

          {/* Row actions */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {creditView === 'customers' && <button
              className="h-10 whitespace-nowrap px-3 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-md text-label-md flex items-center gap-1.5 shadow-sm"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>+ Record Credit Bill</span>
            </button>}
          </div>
        </div>
      </div>

      {creditView === 'customers' && creditBillError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{creditBillError}</div>}

      {creditView === 'customers' ? (
      /* Customer Credit Bills Table */
      <div className="w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col border border-outline-variant/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low h-9 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider select-none">
                <th className="px-space-md py-2">Bill Date</th>
                <th className="px-space-md py-2">Party / Customer Name</th>
                <th className="px-space-md py-2">Status</th>
                <th className="px-space-md py-2 text-right">Existing/Prior Balance (₹)</th>
                <th className="px-space-md py-2 text-right">Bill Amount (₹)</th>
                <th className="px-space-md py-2 text-right">Net Due (₹)</th>
                <th className="px-space-md py-2 text-center w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-md font-body-md text-on-surface">
              {creditBillLoading ? (
                <tr><td colSpan={7} className="px-4 py-14"><LoaderOne /></td></tr>
              ) : pageBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="px-space-md py-2.5 font-data-mono-sm text-data-mono-sm text-on-surface whitespace-nowrap">
                    {bill.billDate}
                  </td>
                  <td className="px-space-md py-2.5 font-title-md text-body-md font-medium text-on-surface">
                    <div className="flex flex-col">
                      <span className="truncate">{bill.partyName}</span>
                      <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">{bill.status === 'Cancelled' ? 'Sale cancelled' : `Term: ${bill.term}`}</span>
                      {bill.status === 'Cancelled' && bill.cancellationReason && <span className="max-w-[220px] truncate text-xs text-on-surface-variant" title={bill.cancellationReason}>Reason: {bill.cancellationReason}</span>}
                      {bill.status === 'Cancelled' && bill.cancelledAt && <span className="text-xs text-on-surface-variant">Cancelled {new Date(bill.cancelledAt).toLocaleDateString()}{bill.cancelledByName ? ` by ${bill.cancelledByName}` : ''}</span>}
                      {bill.status === 'Cancelled' && (bill.payments?.length || 0) > 0 && <span className="max-w-[250px] truncate text-xs text-on-surface-variant" title={bill.payments?.map((payment) => `${payment.method} ${formatCurrency(payment.amount)}`).join(', ')}>Original receipts: {bill.payments?.map((payment) => `${payment.method} ${formatCurrency(payment.amount)}`).join(' · ')}</span>}
                      {bill.status === 'Cancelled' && bill.actualReceivedAmount != null && <span className="text-xs text-on-surface-variant">Verified received: {formatCurrency(bill.actualReceivedAmount)}</span>}
                      {bill.status === 'Cancelled' && (bill.paymentCorrections?.length || 0) > 0 && <span className="max-w-[280px] truncate text-xs text-on-surface-variant" title={bill.paymentCorrections?.map((correction) => `${correction.type === 'REVERSAL' ? 'Reversed' : 'Verified'} ${correction.method} ${formatCurrency(correction.amount)}`).join(', ')}>Payment corrections: {bill.paymentCorrections?.map((correction) => `${correction.type === 'REVERSAL' ? 'Reversed' : 'Verified'} ${correction.method} ${formatCurrency(correction.amount)}`).join(' · ')}</span>}
                      {bill.status === 'Cancelled' && (bill.refunds?.length || 0) > 0 && <span className="max-w-[250px] truncate text-xs text-on-surface-variant" title={bill.refunds?.map((refund) => `${refund.method} ${formatCurrency(refund.amount)}`).join(', ')}>Refunded: {bill.refunds?.map((refund) => `${refund.method} ${formatCurrency(refund.amount)}`).join(' · ')}</span>}
                    </div>
                  </td>
                  <td className="px-space-md py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg font-label-sm text-label-sm font-semibold ${
                        bill.status === 'Overdue'
                          ? 'bg-error-container text-on-error-container'
                          : bill.status === 'Partially Paid'
                          ? 'bg-surface-container-high text-secondary'
                          : bill.status === 'Settled'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                          : bill.status === 'Cancelled'
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {bill.status === 'Overdue' && bill.overdueDays
                        ? `Overdue (${bill.overdueDays}d)`
                        : bill.status}
                    </span>
                  </td>
                  <td className="px-space-md py-2.5 text-right font-data-mono-md text-data-mono-md text-on-surface-variant whitespace-nowrap">
                    {formatCurrency(bill.priorBalance)}
                  </td>
                  <td className="px-space-md py-2.5 text-right font-data-mono-md text-data-mono-md font-semibold text-on-surface whitespace-nowrap">
                    {formatCurrency(bill.billAmount)}
                  </td>
                  <td
                    className={`px-space-md py-2.5 text-right font-data-mono-md text-data-mono-md font-bold whitespace-nowrap ${
                      bill.status === 'Overdue' ? 'text-error' : bill.netDue === 0 ? 'text-on-surface-variant' : 'text-on-surface'
                    }`}
                  >
                    {formatCurrency(bill.netDue)}
                  </td>
                  <td className="px-space-md py-2.5 text-center whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {bill.status !== 'Settled' && bill.status !== 'Cancelled' ? (
                        <button
                          className="h-7 px-2 rounded-lg bg-surface-container-high hover:bg-surface-variant text-primary font-label-sm text-label-sm font-medium transition-colors"
                          title="Record payment against this bill"
                          type="button"
                          onClick={() => handleOpenPayModal(bill)}
                        >
                          Pay
                        </button>
                      ) : (
                        <button
                          className="h-7 px-2 rounded-lg bg-surface-container text-outline font-label-sm text-label-sm font-medium cursor-not-allowed"
                          disabled
                          type="button"
                        >
                          Settled
                        </button>
                      )}
                      <button
                        className="h-7 w-7 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface flex items-center justify-center transition-colors"
                        title="Print Statement"
                        type="button"
                        onClick={() => handlePrintStatement(bill)}
                      >
                        <span className="material-symbols-outlined text-[17px]">print</span>
                      </button>
                      {bill.saleId && bill.status !== 'Cancelled' ? (
                        <button className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-error transition-colors hover:bg-error-container/40 disabled:opacity-50" title="Cancel this sale and safely reverse its stock and credit" aria-label={`Cancel sale ${bill.invoiceReference || bill.billNumber}`} type="button" disabled={savingCancellation} onClick={() => openCancelSale(bill)}>
                          <RotateCcw size={14} aria-hidden="true" /><span className="text-xs font-semibold">Cancel</span>
                        </button>
                      ) : bill.status === 'Cancelled' && (bill.refundPayable || 0) > 0 ? (
                        <button className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2 text-xs font-semibold text-on-primary hover:bg-primary-container" title="Settle pending customer refund" type="button" onClick={() => openSettleRefund(bill)}>
                          Refund {formatCurrency(bill.refundPayable || 0)}
                        </button>
                      ) : !bill.saleId ? (
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg text-error transition-colors hover:bg-error-container/40 disabled:cursor-not-allowed disabled:text-outline/50 disabled:hover:bg-transparent" title={(bill.paidAmount || 0) > 0 ? 'Bills with payment history cannot be deleted' : 'Delete credit bill'} aria-label={`Delete credit bill ${bill.billNumber}`} type="button" disabled={(bill.paidAmount || 0) > 0 || deletingCreditBill} onClick={() => setDeleteModalBill(bill)}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      ) : <span className="px-2 text-xs text-on-surface-variant">{(bill.paidAmount || 0) > 0 ? 'Refund settled' : 'No refund due'}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!creditBillLoading && filteredBills.length === 0 && <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-on-surface-variant">No customer credit bills found.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-space-md py-space-sm bg-surface-container-low/70 flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-outline-variant/20">
          <div className="flex items-center gap-space-md text-on-surface-variant font-label-sm text-label-sm">
            <span>
              Showing <strong className="text-on-surface font-semibold">{customerRange.start} - {customerRange.end}</strong> of{' '}
              <strong className="text-on-surface font-semibold">{filteredBills.length}</strong> customer credit bills
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-space-md">
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Grand total due</div>
              <div className="text-xl font-extrabold text-error">{formatCurrency(grandTotalDue)}</div>
            </div>
            {totalPendingRefunds > 0 && <div className="text-right"><div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Pending refunds</div><div className="text-xl font-extrabold text-primary">{formatCurrency(totalPendingRefunds)}</div></div>}
            <PaginationControls totalRecords={filteredBills.length} page={safeCustomerPage} onPageChange={setCustomerPage} />
          </div>
        </div>
      </div>
      ) : (
        <div className="w-full overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse text-left">
              <thead><tr className="h-10 bg-surface-container-low text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                {['Supplier', 'Purchase date', 'Invoice total (₹)', 'Paid (₹)', 'Outstanding (₹)', 'Status', 'Payments', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-surface-container text-sm text-on-surface">
                {pageSupplierPurchases.map((purchase) => {
                  const due = supplierPurchaseDue(purchase);
                  const paymentRows = supplierLedger.filter((entry) => entry.invoiceNumber === purchase.invoiceNumber && entry.transactionType === 'PAYMENTS');
                  return <tr key={purchase.id || purchase.invoiceNumber} className="transition hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 font-semibold">{purchase.partyName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{String(purchase.invoiceDate || '').slice(0, 10) || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(purchase.totalAmount)}</td>
                    <td className="px-4 py-3">{formatCurrency(purchase.amountPaid || 0)}</td>
                    <td className={`px-4 py-3 font-bold ${due > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{formatCurrency(due)}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-semibold">{due <= 0 ? 'Paid' : Number(purchase.amountPaid || 0) > 0 ? 'Partial' : 'Unpaid'}</span></td>
                    <td className="max-w-[260px] px-4 py-3 text-on-surface-variant">{paymentRows.length ? paymentRows.map((payment, index) => <span key={`${payment.paymentDate}-${index}`} className="block">{payment.paymentDate} · {payment.paymentMode} {formatCurrency(payment.amountPaid)}</span>) : '—'}</td>
                    <td className="px-4 py-3">{due > 0 ? <button type="button" disabled={!purchase.id} onClick={() => openSupplierPayment(purchase)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50" title={!purchase.id ? 'Purchase record ID is unavailable' : 'Record payment against this purchase'}>Record payment</button> : <span className="text-xs text-on-surface-variant">Paid</span>}</td>
                  </tr>;
                })}
                {!supplierPurchases.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-sm text-on-surface-variant">No supplier invoices match these filters.</td></tr>}
              </tbody>
              {!!supplierPurchases.length && <tfoot><tr className="border-t border-outline-variant/20 bg-surface-container-low/70 font-semibold"><td colSpan={2} className="px-4 py-3">Totals</td><td className="px-4 py-3">{formatCurrency(supplierTotals.billed)}</td><td className="px-4 py-3">{formatCurrency(supplierTotals.paid)}</td><td className="px-4 py-3 text-error">{formatCurrency(supplierTotals.due)}</td><td colSpan={3} /></tr></tfoot>}
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-low/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-on-surface-variant">Showing <strong className="text-on-surface">{supplierRange.start}-{supplierRange.end}</strong> of <strong className="text-on-surface">{supplierPurchases.length}</strong> supplier invoices</span>
            <PaginationControls totalRecords={supplierPurchases.length} page={safeSupplierPage} onPageChange={setSupplierPage} />
          </footer>
        </div>
      )}

      {/* Record Credit Bill Sliding Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-on-surface/40 z-50 flex justify-end"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-surface-container-lowest shadow-2xl flex flex-col justify-between h-full animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-space-lg bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-[20px]">post_add</span>
                  <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    Record Credit Bill
                  </span>
                </div>

              </div>
              <button
                className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveCreditBill} className="p-space-lg flex-1 overflow-y-auto space-y-space-md">
              <div className="grid grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md font-semibold text-on-surface">
                    Bill Date <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="h-8 px-2.5 rounded-lg bg-surface-container-low font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
                    value={newBillDate}
                    onChange={(e) => setNewBillDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md font-semibold text-on-surface">
                    Bill Number <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      className="w-full h-8 px-2.5 rounded-lg bg-surface-container-low font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
                      value={newBillNumber}
                      onChange={(e) => setNewBillNumber(e.target.value)}
                    />
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">
                      tag
                    </span>
                  </div>
                </div>
              </div>

              {/* Party Selector */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md font-semibold text-on-surface">
                    Party / Customer Name <span className="text-error">*</span>
                  </label>
                  <span
                    className="font-label-sm text-label-sm text-primary hover:underline cursor-pointer"
                    onClick={() => {
                      const name = prompt('Enter new customer name:');
                      if (name && name.trim()) {
                        const cleanName = name.trim();
                        const address = prompt('Enter customer address:');
                        if (address === null) return;
                        const phone = prompt('Enter customer phone (optional):') || '';
                        void addCustomer({ name: cleanName, phone, address })
                          .then(() => setSelectedParty(cleanName))
                          .catch((error) => showToast(error instanceof Error ? error.message : 'Unable to add the customer.', 'error'));
                      }
                    }}
                  >
                    + New Party
                  </span>
                </div>
                <div className="relative">
                  <select
                    className="w-full h-8 px-2.5 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors appearance-none pr-8 border border-outline-variant/20"
                    value={selectedParty}
                    onChange={(e) => setSelectedParty(e.target.value)}
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.name}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px] pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Prior Balance Card */}
              <div className="p-space-md rounded-xl bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant font-semibold">
                    Prior Due Balance
                  </span>
                  <span className="font-body-sm text-body-sm text-outline">Auto-calculated from ledger</span>
                </div>
                <div className="text-right">
                  <span className="font-data-mono-lg text-data-mono-lg font-bold text-error">
                    {formatCurrency(priorDue)}
                  </span>
                </div>
              </div>

              {/* Bill Amount */}
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md font-semibold text-on-surface">
                  Bill Amount (₹) <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-data-mono-md text-data-mono-md text-outline">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    className="w-full h-8 pl-7 pr-3 rounded-lg bg-surface-container-low font-data-mono-md text-data-mono-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                  />
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                  Post-entry expected party balance:{' '}
                  <strong className="text-on-surface font-data-mono-sm text-data-mono-sm">
                    {formatCurrency(expectedBalance)}
                  </strong>
                </p>
              </div>

              {/* Due Date & Term */}
              <div className="grid grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md font-semibold text-on-surface">Payment Due Date</label>
                  <input
                    type="date"
                    className="h-8 px-2.5 rounded-lg bg-surface-container-low font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none border border-outline-variant/20"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md font-semibold text-on-surface">Credit Term</label>
                  <select
                    className="h-8 px-2.5 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none border border-outline-variant/20"
                    value={newCreditTerm}
                    onChange={(e) => setNewCreditTerm(e.target.value)}
                  >
                    <option>Due on agreed date</option>
                    <option>15 Days</option>
                    <option>30 Days</option>
                    <option>45 Days</option>
                    <option>60 Days</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md font-semibold text-on-surface">Remarks / Notes</label>
                <textarea
                  rows={3}
                  className="w-full p-2.5 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none border border-outline-variant/20 resize-none"
                  placeholder="Reference sales order number, delivery challan, or approval note..."
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                />
              </div>



              <div className="p-space-lg bg-surface-container-low flex items-center justify-end gap-space-sm -mx-space-lg -mb-space-lg border-t border-outline-variant/20 mt-4">
                <button
                  type="button"
                  className="h-8 px-4 rounded-lg bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCreditBill}
                  className="h-8 px-4 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-md text-label-md flex items-center gap-1.5 shadow-sm disabled:cursor-wait disabled:opacity-70"
                >
                  {savingCreditBill ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <span className="material-symbols-outlined text-[16px]">check</span>}
                  <span>{savingCreditBill ? 'Saving…' : 'Save Credit Bill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModalBill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4"
          onClick={() => { if (!postingPayment) setPayModalBill(null); }}
        >
          <div
            className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Record Payment for {payModalBill.billNumber}
              </h3>
              <button
                type="button"
                disabled={postingPayment}
                className="text-on-surface-variant hover:text-on-surface p-1"
                onClick={() => { if (!postingPayment) setPayModalBill(null); }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="py-space-md space-y-3 font-body-md">
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Party</span>
                <p className="font-semibold text-on-surface">{payModalBill.partyName}</p>
              </div>
              <div className="flex justify-between bg-surface-container-low p-2 rounded">
                <span className="text-on-surface-variant">Current Net Due:</span>
                <span className="font-bold text-error">{formatCurrency(payModalBill.netDue)}</span>
              </div>
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payModalBill.netDue}
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-surface-container-low font-data-mono-md text-data-mono-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30"
                />
              </div>
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">
                  Payment Mode
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full h-8 px-2.5 rounded bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none border border-outline-variant/30"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-space-sm border-t border-surface-container">
              <button
                type="button"
                disabled={postingPayment}
                className="h-8 px-3 rounded font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
                onClick={() => { if (!postingPayment) setPayModalBill(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={postingPayment}
                className="h-8 px-4 rounded bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container shadow-sm flex items-center gap-2 disabled:cursor-wait disabled:opacity-70"
                onClick={handleConfirmPay}
              >
                {postingPayment && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}
                {postingPayment ? 'Posting…' : 'Post Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      {supplierPayPurchase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/40 p-4" onClick={() => { if (!savingSupplierPayment) setSupplierPayPurchase(null); }}>
          <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-space-lg shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between border-b border-surface-container pb-3">
              <div><h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Record supplier payment</h3><p className="mt-1 text-sm text-on-surface-variant">{supplierPayPurchase.partyName} · {String(supplierPayPurchase.invoiceDate).slice(0, 10)}</p></div>
              <button type="button" disabled={savingSupplierPayment} onClick={() => setSupplierPayPurchase(null)} className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-lg bg-surface-container-low p-3 text-sm"><span className="text-on-surface-variant">Invoice balance</span><strong className="text-error">{formatCurrency(supplierPurchaseDue(supplierPayPurchase))}</strong></div>
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant">Amount (₹)<input type="number" min="0.01" step="0.01" max={supplierPurchaseDue(supplierPayPurchase)} value={supplierPayAmount} onChange={(event) => setSupplierPayAmount(event.target.value)} className="h-10 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant">Payment date<input type="date" value={supplierPayDate} onChange={(event) => setSupplierPayDate(event.target.value)} className="h-10 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary" /></label>
                <label className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant">Method<select value={supplierPayMethod} onChange={(event) => setSupplierPayMethod(event.target.value as typeof supplierPayMethod)} className="h-10 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary">{['Cash', 'UPI', 'Bank transfer', 'Cheque'].map((method) => <option key={method}>{method}</option>)}</select></label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-surface-container pt-3">
              <button type="button" disabled={savingSupplierPayment} onClick={() => setSupplierPayPurchase(null)} className="h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low">Cancel</button>
              <button type="button" disabled={savingSupplierPayment} onClick={() => void handleSupplierPayment()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary-container disabled:cursor-wait disabled:opacity-70">{savingSupplierPayment && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}{savingSupplierPayment ? 'Saving…' : 'Save payment'}</button>
            </div>
          </div>
        </div>
      )}
      {cancelModalBill && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-inverse-surface/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingCancellation) setCancelModalBill(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="cancel-sale-title" className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex shrink-0 items-center gap-3 border-b border-surface-container px-5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"><AlertTriangle size={18} aria-hidden="true" /></div>
              <h2 id="cancel-sale-title" className="min-w-0 flex-1 text-lg font-semibold text-on-surface">Cancel this sale?</h2>
              <button type="button" disabled={savingCancellation} onClick={() => setCancelModalBill(null)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container disabled:opacity-50" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="col-span-2 rounded-lg bg-surface-container-low px-3 py-2 sm:col-span-2"><div className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Invoice · Customer</div><strong className="block truncate text-sm text-on-surface">{cancelModalBill.invoiceReference || cancelModalBill.billNumber} · {cancelModalBill.partyName}</strong></div>
                <div className="rounded-lg bg-surface-container-low px-3 py-2"><div className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Bill amount</div><strong className="text-sm text-on-surface">{formatCurrency(cancelModalBill.billAmount)}</strong></div>
                <div className="rounded-lg bg-surface-container-low px-3 py-2"><div className="text-[11px] font-medium uppercase tracking-wide text-on-surface-variant">Credit to reverse</div><strong className="text-sm text-on-surface">{formatCurrency(cancelModalBill.netDue)}</strong></div>
                <div className="col-span-2 flex items-center justify-between rounded-lg border border-outline-variant/20 px-3 py-2 text-sm sm:col-span-4"><span className="text-on-surface-variant">{hasRecordedPayments ? 'Refund required' : 'No cash or UPI recorded · Refund required'}</span><strong className="text-on-surface">{formatCurrency(actualReceivedAmount)}</strong></div>
                {!hasRecordedPayments && recordedStoreCreditAmount > 0 && <div className="col-span-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-on-surface-variant sm:col-span-4">Store Credit used · {formatCurrency(recordedStoreCreditAmount)} will be restored when this sale is cancelled.</div>}
              </div>
              {hasRecordedPayments && (
                <section className="overflow-hidden rounded-lg border border-outline-variant/25">
                  <button type="button" aria-expanded={paymentSectionOpen} onClick={() => setPaymentSectionOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-container-low">
                    <span><strong className="block text-sm text-on-surface">Payment received?</strong><span className="text-xs text-on-surface-variant">Recorded: {formatCurrency(recordedCollectedAmount)} · Actual: {formatCurrency(actualReceivedAmount)}</span></span>
                    <ChevronDown size={17} className={`shrink-0 text-on-surface-variant transition-transform ${paymentSectionOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {paymentSectionOpen && <div className="space-y-3 border-t border-outline-variant/20 bg-surface-container-low p-3">
                    <div className="space-y-1 rounded-md bg-surface-container-lowest px-3 py-2">
                      {(cancelModalBill.payments || []).map((payment) => <div key={payment.id} className="flex justify-between gap-3 text-sm"><span className="text-on-surface-variant">{payment.method === 'COUPON' ? 'Coupon' : payment.method}</span><strong className="text-on-surface">{formatCurrency(payment.amount)}</strong></div>)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {cancellationPaymentMethods.map((method) => <label key={method} className="text-xs font-medium text-on-surface-variant">Actual {method === 'UPI' ? 'UPI' : method.charAt(0) + method.slice(1).toLowerCase()}<input inputMode="decimal" value={actualPaymentAmounts[method]} onChange={(event) => { setActualPaymentAmounts((current) => ({ ...current, [method]: event.target.value })); setActualReceivedConfirmed(false); }} className="mt-1 h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary" placeholder="0" /></label>)}
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-surface-container-lowest px-3 py-2 text-sm"><span className="text-on-surface-variant">Actual amount received</span><strong className="text-on-surface">{formatCurrency(actualReceivedAmount)} <span className="text-xs font-normal">(max {formatCurrency(Math.min(recordedCollectedAmount, cancelModalBill.billAmount))})</span></strong></div>
                    <label className="flex cursor-pointer items-start gap-2 text-xs text-on-surface"><input type="checkbox" checked={actualReceivedConfirmed} onChange={(event) => setActualReceivedConfirmed(event.target.checked)} className="mt-0.5 accent-primary" /><span>I confirm the actual amount above is correct.</span></label>
                  </div>}
                </section>
              )}
              {actualReceivedAmount > 0 && <div className="space-y-3 rounded-lg border border-outline-variant/25 p-3">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-on-surface">Refund handling</h3><span className="text-xs text-on-surface-variant">Received {formatCurrency(actualReceivedAmount)}</span></div>
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setRefundMode('PENDING')} className={`rounded-lg border px-3 py-2 text-left text-sm ${refundMode === 'PENDING' ? 'border-primary bg-primary/10 text-on-surface' : 'border-outline-variant/30 text-on-surface-variant'}`}><strong className="block">Refund pending</strong><span className="text-xs">Pay later</span></button><button type="button" onClick={() => setRefundMode('NOW')} className={`rounded-lg border px-3 py-2 text-left text-sm ${refundMode === 'NOW' ? 'border-primary bg-primary/10 text-on-surface' : 'border-outline-variant/30 text-on-surface-variant'}`}><strong className="block">Refund now</strong><span className="text-xs">Record payout</span></button></div>
                {refundMode === 'NOW' && <>
                  {refundLines.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                    <label className="text-xs font-medium text-on-surface-variant">Refund amount<input inputMode="decimal" value={line.amount} onChange={(event) => setRefundLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))} className="mt-1 h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary" /></label>
                    <label className="text-xs font-medium text-on-surface-variant">Method<select value={line.method} onChange={(event) => setRefundLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, method: event.target.value as typeof row.method } : row))} className="mt-1 h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-2 text-sm text-on-surface outline-none focus:border-primary"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="OTHER">Other</option></select></label>
                    <label className="text-xs font-medium text-on-surface-variant">Reference (optional)<input value={line.reference} onChange={(event) => setRefundLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, reference: event.target.value } : row))} className="mt-1 h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary" /></label>
                    <button type="button" disabled={refundLines.length <= 1} onClick={() => setRefundLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="mt-4 flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low disabled:opacity-30" aria-label="Remove refund method"><X size={15} /></button>
                  </div>)}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><button type="button" onClick={() => setRefundLines((rows) => [...rows, { amount: '', method: 'UPI', reference: '' }])} className="inline-flex h-8 items-center gap-1 rounded-lg border border-outline-variant/30 px-2.5 font-semibold text-on-surface hover:bg-surface-container-low"><Plus size={13} /> Add method</button><span className="text-on-surface-variant">Now: {formatCurrency(refundLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0))} · Pending: {formatCurrency(Math.max(0, actualReceivedAmount - refundLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)))}</span></div>
                </>}
              </div>}
              {cancelModalBill.saleItems?.length ? <div><h3 className="mb-1.5 text-sm font-semibold text-on-surface">Stock to restore</h3><ul className="max-h-32 divide-y divide-outline-variant/20 overflow-y-auto rounded-lg border border-outline-variant/20">{cancelModalBill.saleItems.map((item, index) => <li key={`${item.productName}-${index}`} className="flex justify-between gap-4 px-3 py-1.5 text-sm"><span className="truncate text-on-surface">{item.productName}</span><strong className="shrink-0 text-on-surface">{item.quantity} {item.unitSymbol || item.unitName}</strong></li>)}</ul></div> : null}
              <div>
                <span className="text-xs font-semibold text-on-surface-variant">Quick reasons</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {['Wrong customer', 'Incorrect items', 'Duplicate bill'].map((reason) => (
                    <button key={reason} type="button" aria-pressed={cancellationReason === reason} onClick={() => setCancellationReason(reason)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${cancellationReason === reason ? 'border-primary bg-primary/10 text-on-surface' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50 hover:bg-surface-container-low'}`}>
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-xs font-semibold text-on-surface-variant">Cancellation reason <span>*</span><textarea required maxLength={1000} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} rows={2} placeholder="Choose a reason or enter a short explanation" className="mt-1 w-full resize-y rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" /></label>
            </div>
            <div className="sticky bottom-0 flex shrink-0 justify-end gap-2 border-t border-surface-container bg-surface-container-lowest px-4 py-3 sm:px-5"><button type="button" disabled={savingCancellation} onClick={() => setCancelModalBill(null)} className="h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50">Keep sale</button><button type="button" disabled={savingCancellation || !cancellationReason.trim() || !actualReceivedConfirmed} onClick={() => void handleCancelSale()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-error px-4 text-sm font-semibold text-white shadow-sm hover:bg-error/90 disabled:opacity-60">{savingCancellation && <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />}{savingCancellation ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
          </section>
        </div>
      )}
      {refundModalBill && (
        <div className="fixed inset-0 z-[86] flex items-center justify-center bg-inverse-surface/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingRefundSettlement) setRefundModalBill(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="settle-refund-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-surface-container p-5"><h2 id="settle-refund-title" className="text-lg font-semibold text-on-surface">Settle pending refund</h2><p className="mt-1 text-sm text-on-surface-variant">{refundModalBill.partyName} · {refundModalBill.invoiceReference || refundModalBill.billNumber}</p></div>
            <div className="space-y-3 p-5"><div className="flex justify-between rounded-lg bg-surface-container-low p-3 text-sm"><span className="text-on-surface-variant">Pending</span><strong className="text-error">{formatCurrency(refundModalBill.refundPayable || 0)}</strong></div><label className="block text-sm font-medium text-on-surface-variant">Refund amount<input inputMode="decimal" value={refundSettlementAmount} onChange={(event) => setRefundSettlementAmount(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary" /></label><label className="block text-sm font-medium text-on-surface-variant">Refund method<select value={refundSettlementMethod} onChange={(event) => setRefundSettlementMethod(event.target.value as typeof refundSettlementMethod)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="OTHER">Other</option></select></label>{(refundModalBill.payments?.length || 0) > 0 && <label className="block text-sm font-medium text-on-surface-variant">Link to original receipt (optional)<select value={refundSettlementOriginalPaymentId} onChange={(event) => setRefundSettlementOriginalPaymentId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary"><option value="">No specific receipt</option>{refundModalBill.payments?.map((payment) => <option key={payment.id} value={payment.id}>{payment.method} · {formatCurrency(payment.amount)} · {new Date(payment.date).toLocaleDateString()}</option>)}</select></label>}<label className="block text-sm font-medium text-on-surface-variant">Reference (optional)<input value={refundSettlementReference} onChange={(event) => setRefundSettlementReference(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary" /></label></div>
            <div className="flex justify-end gap-2 border-t border-surface-container px-5 py-4"><button type="button" disabled={savingRefundSettlement} onClick={() => setRefundModalBill(null)} className="h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low">Cancel</button><button type="button" disabled={savingRefundSettlement} onClick={() => void handleSettleRefund()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary-container disabled:opacity-60">{savingRefundSettlement && <LoaderCircle size={15} className="animate-spin" />}{savingRefundSettlement ? 'Saving…' : 'Record refund'}</button></div>
          </section>
        </div>
      )}
      {deleteModalBill && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-inverse-surface/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingCreditBill) setDeleteModalBill(null); }}
        >
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-credit-bill-title" aria-describedby="delete-credit-bill-description" className="w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container/50 text-error"><AlertTriangle size={21} aria-hidden="true" /></div>
              <div className="min-w-0 flex-1">
                <h2 id="delete-credit-bill-title" className="text-lg font-semibold text-on-surface">Delete this credit bill?</h2>
                <p id="delete-credit-bill-description" className="mt-1 text-sm leading-5 text-on-surface-variant">This permanently removes the manually entered, unpaid credit bill. Bills linked to sales or with payment history are protected.</p>
              </div>
            </div>
            <div className="mx-5 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-on-surface-variant">Bill</span><strong className="truncate text-on-surface">{deleteModalBill.billNumber}</strong></div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm"><span className="text-on-surface-variant">Customer</span><strong className="truncate text-on-surface">{deleteModalBill.partyName}</strong></div>
              <div className="mt-1 flex items-center justify-between gap-3 text-sm"><span className="text-on-surface-variant">Amount</span><strong className="text-on-surface">{formatCurrency(deleteModalBill.billAmount)}</strong></div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-surface-container px-5 py-4">
              <button type="button" disabled={deletingCreditBill} onClick={() => setDeleteModalBill(null)} className="h-10 rounded-lg px-4 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low disabled:opacity-60">Cancel</button>
              <button type="button" disabled={deletingCreditBill} onClick={() => void handleConfirmDeleteCreditBill()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-error px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-error/90 disabled:cursor-wait disabled:opacity-70">
                {deletingCreditBill ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                {deletingCreditBill ? 'Deleting…' : 'Delete bill'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
