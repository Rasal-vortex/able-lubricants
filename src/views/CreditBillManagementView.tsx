import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CreditBill } from '../types';
import { formatCurrency } from '../utils/currency';

export const CreditBillManagementView: React.FC = () => {
  const {
    creditBills,
    addCreditBill,
    collectCreditPayment,
    setActiveScreen,
    showToast,
    setActiveReceiptToPrint,
    customers,
    partyLedger,
    addCustomer,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Overdue' | 'Partial' | 'Unpaid'>('All');

  // Record Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newBillDate, setNewBillDate] = useState(localToday);
  const [newBillNumber, setNewBillNumber] = useState(() => `CR-${Date.now().toString().slice(-7)}`);
  const [selectedParty, setSelectedParty] = useState(customers[0]?.name || '');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState(() => { const due = new Date(); due.setDate(due.getDate() + 14); return new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
  const [newCreditTerm, setNewCreditTerm] = useState('Due on agreed date');
  const [newRemarks, setNewRemarks] = useState('');

  // Inline Pay modal
  const [payModalBill, setPayModalBill] = useState<CreditBill | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank Wire' | 'UPI Transfer'>('Bank Wire');

  // Party balances lookup
  const priorDue = partyLedger.filter(row => row.partyName === selectedParty && row.transactionType === 'INVOICES').reduce((sum, row) => sum + row.outstandingBalance, 0);
  const currentAmt = parseFloat(newBillAmount) || 0;
  const expectedBalance = priorDue + currentAmt;

  // Filter bills
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

    const parsedDate = new Date(bill.billDate);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(bill.billDate) ? bill.billDate : Number.isNaN(parsedDate.getTime()) ? bill.billDate : new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateMatch = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    return matchesSearch && matchesStatus && dateMatch;
  });

  const handleSaveCreditBill = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newBillAmount);
    if (!selectedParty || !newBillNumber.trim() || isNaN(amt) || amt <= 0) {
      showToast('Choose a customer and specify a valid bill number and amount.', 'error');
      return;
    }

    addCreditBill({
      billDate: newBillDate,
      billNumber: newBillNumber.trim(),
      partyName: selectedParty,
      gstin: '',
      term: newCreditTerm,
      status: 'Unpaid',
      priorBalance: priorDue,
      billAmount: amt,
      netDue: priorDue + amt,
      dueDate: newDueDate,
      remarks: newRemarks,
    });

    setDrawerOpen(false);
    setNewBillNumber(`CR-${Date.now().toString().slice(-7)}`);
  };

  const handleOpenPayModal = (bill: CreditBill) => {
    setPayModalBill(bill);
    setPayAmountInput(bill.netDue.toString());
  };

  const handleConfirmPay = () => {
    if (!payModalBill) return;
    const amt = parseFloat(payAmountInput);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    collectCreditPayment(payModalBill.billNumber, amt, payMethod);
    setPayModalBill(null);
  };

  const handleExportLedger = () => {
    const rows = [
      ['Bill Date', 'Bill Number', 'Party Name', 'GSTIN', 'Term', 'Status', 'Prior Balance (INR)', 'Bill Amount (INR)', 'Net Due (INR)'],
      ...creditBills.map((b) => [
        b.billDate,
        b.billNumber,
        `"${b.partyName.replace(/"/g, '""')}"`,
        b.gstin,
        b.term,
        b.status,
        formatCurrency(b.priorBalance),
        formatCurrency(b.billAmount),
        formatCurrency(b.netDue),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Credit_Ledger_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Credit ledger exported successfully.');
  };

  const handlePrintStatement = (bill: CreditBill) => {
    setActiveReceiptToPrint({
      title: 'Credit Billing Statement',
      refNumber: bill.billNumber,
      date: bill.billDate,
      party: bill.partyName,
      total: bill.netDue,
      mode: `Credit (${bill.term}) - Due: ${bill.dueDate}`,
    });
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Page Context & Primary Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-space-md pb-space-sm">
        <div className="flex items-center gap-space-sm">
          <button
            className="h-8 px-3 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-low transition-colors font-label-md text-label-md flex items-center gap-1.5 shadow-sm border border-outline-variant/30"
            type="button"
            onClick={handleExportLedger}
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">file_download</span>
            <span>Export Ledger</span>
          </button>
          <button
            className="h-8 px-3 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-md text-label-md flex items-center gap-1.5 shadow-sm"
            onClick={() => setDrawerOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ Record Credit Bill</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Controls Bar */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-md mb-space-md shadow-sm border border-outline-variant/20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-center">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface-container-low font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
              placeholder="Search by customer name, party, or bill number..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <div className="md:col-span-4 flex items-center gap-space-xs">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[15px]">
                calendar_today
              </span>
              <input
                className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface-container-low font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <span className="text-outline font-label-sm text-label-sm">to</span>
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[15px]">
                event
              </span>
              <input
                className="w-full h-8 pl-8 pr-2 rounded-lg bg-surface-container-low font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors border border-outline-variant/20"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {/* Status Tabs */}
          <div className="md:col-span-3 flex items-center justify-end gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant hidden xl:inline">Status:</span>
            <div className="inline-flex rounded-lg bg-surface-container-low p-0.5 w-full md:w-auto border border-outline-variant/20">
              {(['All', 'Overdue', 'Partial', 'Unpaid'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg font-label-sm text-label-sm transition-colors ${
                    statusFilter === tab
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Credit Bills Table */}
      <div className="w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col border border-outline-variant/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low h-9 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider select-none">
                <th className="px-space-md py-2 w-10">
                  <input
                    className="w-3.5 h-3.5 rounded bg-surface-container-lowest text-primary focus:ring-0 cursor-pointer"
                    type="checkbox"
                  />
                </th>
                <th className="px-space-md py-2">Bill Date</th>
                <th className="px-space-md py-2">Bill Number</th>
                <th className="px-space-md py-2">Party / Customer Name</th>
                <th className="px-space-md py-2">Status</th>
                <th className="px-space-md py-2 text-right">Existing/Prior Balance (₹)</th>
                <th className="px-space-md py-2 text-right">Bill Amount (₹)</th>
                <th className="px-space-md py-2 text-right">Net Due (₹)</th>
                <th className="px-space-md py-2 text-center w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-md font-body-md text-on-surface">
              {filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="px-space-md py-2.5">
                    <input
                      className="w-3.5 h-3.5 rounded bg-surface-container-lowest text-primary focus:ring-0 cursor-pointer"
                      type="checkbox"
                    />
                  </td>
                  <td className="px-space-md py-2.5 font-data-mono-sm text-data-mono-sm text-on-surface whitespace-nowrap">
                    {bill.billDate}
                  </td>
                  <td className="px-space-md py-2.5 font-data-mono-md text-data-mono-md font-semibold text-primary whitespace-nowrap">
                    {bill.billNumber}
                  </td>
                  <td className="px-space-md py-2.5 font-title-md text-body-md font-medium text-on-surface">
                    <div className="flex flex-col">
                      <span className="truncate">{bill.partyName}</span>
                      <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                        GSTIN: {bill.gstin} • Term: {bill.term}
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
                        title="View Customer Ledger"
                        type="button"
                        onClick={() => setActiveScreen('party-ledger-management')}
                      >
                        <span className="material-symbols-outlined text-[17px]">menu_book</span>
                      </button>
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
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-space-md py-space-sm bg-surface-container-low/70 flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-outline-variant/20">
          <div className="flex items-center gap-space-md text-on-surface-variant font-label-sm text-label-sm">
            <span>
              Showing <strong className="text-on-surface font-semibold">1 - {filteredBills.length}</strong> of{' '}
              <strong className="text-on-surface font-semibold">{creditBills.length}</strong> credit bills
            </span>
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
                <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Post an unpaid or partial invoice to party ledger
                </span>
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
                  <div className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">Limit: {formatCurrency(10000)}</div>
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
                    step="0.01"
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

              <div className="flex items-center gap-space-xs text-outline font-data-mono-sm text-data-mono-sm pt-space-xs">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                <span>Ledger lock status: Active • Automated reconciliation enabled</span>
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
                  className="h-8 px-4 rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-md text-label-md flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Save Credit Bill</span>
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
          onClick={() => setPayModalBill(null)}
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
                className="text-on-surface-variant hover:text-on-surface p-1"
                onClick={() => setPayModalBill(null)}
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
                  <option value="Bank Wire">Bank Wire</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI Transfer">UPI Transfer</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-space-sm border-t border-surface-container">
              <button
                type="button"
                className="h-8 px-3 rounded font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
                onClick={() => setPayModalBill(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-8 px-4 rounded bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container shadow-sm"
                onClick={handleConfirmPay}
              >
                Post Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
