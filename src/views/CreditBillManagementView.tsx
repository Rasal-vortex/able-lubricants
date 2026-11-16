import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CreditBill, PurchaseBill } from '../types';
import { formatCurrency } from '../utils/currency';
import LoaderOne from '../components/ui/loader-one';

export const CreditBillManagementView: React.FC = () => {
  const {
    creditBills,
    creditBillLoading,
    creditBillError,
    addCreditBill,
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
  const [statusFilter, setStatusFilter] = useState<'All' | 'Overdue' | 'Partial' | 'Unpaid' | 'Paid'>('All');

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
  const [supplierPayPurchase, setSupplierPayPurchase] = useState<PurchaseBill | null>(null);
  const [supplierPayAmount, setSupplierPayAmount] = useState('');
  const [supplierPayDate, setSupplierPayDate] = useState(localToday);
  const [supplierPayMethod, setSupplierPayMethod] = useState<'Cash' | 'UPI' | 'Bank transfer' | 'Cheque'>('Cash');
  const [savingSupplierPayment, setSavingSupplierPayment] = useState(false);

  // Party balances lookup
  const priorDue = creditBills.filter((bill) => bill.partyName === selectedParty && bill.netDue > 0).reduce((sum, bill) => sum + bill.netDue, 0);
  const currentAmt = parseFloat(newBillAmount) || 0;
  const expectedBalance = priorDue + currentAmt;

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

    const parsedDate = new Date(bill.billDate);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(bill.billDate) ? bill.billDate : Number.isNaN(parsedDate.getTime()) ? bill.billDate : new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateMatch = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    const matchesParty = customerFilter === 'ALL' || bill.partyName === customerFilter;
    return matchesParty && matchesSearch && matchesStatus && dateMatch;
  });
  const grandTotalDue = filteredBills.reduce((total, bill) => total + bill.netDue, 0);

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
              {(creditView === 'customers' ? ['All', 'Overdue', 'Partial', 'Unpaid', 'Paid'] : ['All', 'Partial', 'Unpaid', 'Paid']).map((status) => <option key={status} value={status}>{status}</option>)}
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
              ) : filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="px-space-md py-2.5 font-data-mono-sm text-data-mono-sm text-on-surface whitespace-nowrap">
                    {bill.billDate}
                  </td>
                  <td className="px-space-md py-2.5 font-title-md text-body-md font-medium text-on-surface">
                    <div className="flex flex-col">
                      <span className="truncate">{bill.partyName}</span>
                      <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                        Term: {bill.term}
                      </span>
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
                      {bill.status !== 'Settled' ? (
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
              Showing <strong className="text-on-surface font-semibold">1 - {filteredBills.length}</strong> of{' '}
              <strong className="text-on-surface font-semibold">{creditBills.length}</strong> customer credit bills
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-space-md">
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Grand total due</div>
              <div className="text-xl font-extrabold text-error">{formatCurrency(grandTotalDue)}</div>
            </div>
            <div className="flex items-center gap-space-xs">
            <button
              className="h-7 w-7 rounded-lg bg-surface-container-lowest text-outline opacity-50 flex items-center justify-center cursor-not-allowed"
              disabled
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <button className="h-7 px-2.5 rounded-lg bg-primary text-on-primary font-data-mono-sm text-data-mono-sm font-semibold" type="button">
              1
            </button>
            <button className="h-7 px-2.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-data-mono-sm text-data-mono-sm transition-colors" type="button">
              2
            </button>
            <button className="h-7 px-2.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-data-mono-sm text-data-mono-sm transition-colors" type="button">
              3
            </button>
            <button className="h-7 w-7 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors" type="button">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
            </div>
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
                {supplierPurchases.map((purchase) => {
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
    </div>
  );
};
