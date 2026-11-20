import React, { useEffect, useState } from 'react';
import { Building2, CreditCard, FileText, LoaderCircle, Package, Pencil, Plus, Printer, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { createSupplierPaymentRequest, getSupplierLedgerReport } from '../services/api';
import { NumericTextInput } from '../components/ui/NumericTextInput';
import LoaderOne from '../components/ui/loader-one';
import { formatCurrency } from '../utils/currency';
import { DEFAULT_PAGE_SIZE, getPageRecords, getPaginationRange, PaginationControls } from '../components/PaginationControls';

type SupplierLedgerPurchase = {
  id: string;
  purchaseNumber: string;
  supplierInvoiceNumber?: string | null;
  date: string;
  total: string | number;
  paid: string | number;
  outstanding: string | number;
  items: Array<{
    id: string;
    productName: string;
    quantity: string | number;
    unitName?: string | null;
    purchaseRate: string | number;
    lineTotal: string | number;
  }>;
  payments: Array<{
    id: string;
    paymentGroupId?: string | null;
    amount: string | number;
    method: string;
    date: string;
    receiptNumber?: string | null;
  }>;
};

type SupplierLedger = {
  supplier: { id: string; name: string; phone?: string | null };
  totals: { billed: string | number; paid: string | number; outstanding: string | number };
  purchases: SupplierLedgerPurchase[];
};

type SupplierPaymentReceipt = {
  firstPaymentId: string;
  date: string;
  amount: number;
  methods: Set<string>;
  purchaseNumbers: Set<string>;
  receiptNumber: string | null;
};

const localToday = () => {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const escapeHtml = (value: string | number) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const PartyLedgerManagementView: React.FC = () => {
  const {
    suppliers,
    addSupplier,
    updateSupplier,
    deactivateSupplier,
    supplierLoading,
    supplierError,
    authSession,
    showToast,
  } = useApp();
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [ledger, setLedger] = useState<SupplierLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cashPaymentAmount, setCashPaymentAmount] = useState('');
  const [upiPaymentAmount, setUpiPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localToday);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [purchasePage, setPurchasePage] = useState(1);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);
  const newestFirstPurchases = [...(ledger?.purchases || [])].sort((left, right) =>
    new Date(right.date).getTime() - new Date(left.date).getTime(),
  );
  const purchasePageCount = Math.max(1, Math.ceil(newestFirstPurchases.length / DEFAULT_PAGE_SIZE));
  const safePurchasePage = Math.min(purchasePage, purchasePageCount);
  const pageLedgerPurchases = getPageRecords(newestFirstPurchases, safePurchasePage);
  const purchaseRange = getPaginationRange(newestFirstPurchases.length, safePurchasePage);
  useEffect(() => { setPurchasePage(1); }, [selectedSupplierId]);
  useEffect(() => { if (purchasePage > purchasePageCount) setPurchasePage(purchasePageCount); }, [purchasePage, purchasePageCount]);
  const paymentReceipts = new Map<string, SupplierPaymentReceipt>();
  for (const purchase of newestFirstPurchases) {
    for (const payment of purchase.payments) {
      const key = payment.paymentGroupId || payment.id;
      const receipt = paymentReceipts.get(key) || {
        firstPaymentId: payment.id,
        date: payment.date,
        amount: 0,
        methods: new Set<string>(),
        purchaseNumbers: new Set<string>(),
        receiptNumber: payment.receiptNumber || null,
      };
      receipt.amount += Number(payment.amount) || 0;
      receipt.methods.add(payment.method);
      receipt.purchaseNumbers.add(purchase.supplierInvoiceNumber || purchase.purchaseNumber);
      paymentReceipts.set(key, receipt);
    }
  }

  useEffect(() => {
    if (!selectedSupplierId || suppliers.some((supplier) => supplier.id === selectedSupplierId)) return;
    setSelectedSupplierId('');
  }, [selectedSupplierId, suppliers]);

  useEffect(() => {
    if (!authSession || !selectedSupplierId) {
      setLedger(null);
      setLedgerError('');
      return;
    }
    let current = true;
    setLedgerLoading(true);
    setLedgerError('');
    getSupplierLedgerReport(authSession.token, selectedSupplierId)
      .then((data) => { if (current) setLedger(data as SupplierLedger); })
      .catch((error) => { if (current) setLedgerError(error instanceof Error ? error.message : 'Unable to load this supplier ledger.'); })
      .finally(() => { if (current) setLedgerLoading(false); });
    return () => { current = false; };
  }, [authSession, selectedSupplierId]);

  const resetSupplierForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setEditingSupplierId(null);
    setSupplierModalOpen(false);
  };

  const submitSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || savingSupplier) return;
    const payload = { name: name.trim(), phone: phone.replace(/\D/g, ''), address: address.trim() };
    setSavingSupplier(true);
    try {
      if (editingSupplierId) await updateSupplier(editingSupplierId, payload);
      else await addSupplier(payload);
      resetSupplierForm();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save the supplier.', 'error');
    } finally {
      setSavingSupplier(false);
    }
  };

  const editSupplier = (supplier: (typeof suppliers)[number]) => {
    setSelectedSupplierId(supplier.id);
    setEditingSupplierId(supplier.id);
    setName(supplier.name);
    setPhone(supplier.phone.replace(/\D/g, ''));
    setAddress(supplier.address || '');
    setSupplierModalOpen(true);
  };

  const removeSupplier = async (supplier: (typeof suppliers)[number]) => {
    if (!window.confirm(`Deactivate ${supplier.name}? They will no longer appear in supplier selection.`)) return;
    try {
      await deactivateSupplier(supplier.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to deactivate the supplier.', 'error');
    }
  };

  const reloadLedger = async () => {
    if (!authSession || !selectedSupplierId) return;
    const data = await getSupplierLedgerReport(authSession.token, selectedSupplierId);
    setLedger(data as SupplierLedger);
  };

  const printSupplierLedger = () => {
    if (!ledger) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      showToast('Allow pop-ups to print or save the supplier ledger as PDF.', 'error');
      return;
    }
    const transactions = newestFirstPurchases.flatMap((purchase, purchaseIndex) => [
      {
        date: String(purchase.date).slice(0, 10),
        kind: 'Purchase' as const,
        order: purchaseIndex,
        description: 'Goods received',
        debit: Number(purchase.total) || 0,
        credit: 0,
      },
      ...purchase.payments.map((payment, paymentIndex) => ({
        date: String(payment.date).slice(0, 10),
        kind: 'Payment' as const,
        order: purchaseIndex + paymentIndex / 1000,
        description: `Payment received · ${payment.method === 'CASH' ? 'Cash' : payment.method === 'UPI' ? 'UPI' : payment.method}${payment.receiptNumber ? ` · Receipt #${payment.receiptNumber}` : ''}`,
        debit: 0,
        credit: Number(payment.amount) || 0,
      })),
    ]).sort((left, right) => left.date.localeCompare(right.date) || Number(left.kind === 'Payment') - Number(right.kind === 'Payment') || left.order - right.order);
    let runningBalance = 0;
    const statementRows = transactions.length
      ? transactions.map((transaction) => {
          runningBalance = Math.round((runningBalance + transaction.debit - transaction.credit) * 100) / 100;
          const dateValue = new Date(`${transaction.date}T12:00:00`);
          const displayDate = Number.isNaN(dateValue.getTime())
            ? transaction.date
            : dateValue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          return `<tr>
            <td class="date">${escapeHtml(displayDate)}</td>
            <td><span class="type ${transaction.kind.toLowerCase()}">${escapeHtml(transaction.kind)}</span><span class="description">${escapeHtml(transaction.description)}</span></td>
            <td class="amount">${transaction.debit ? escapeHtml(formatCurrency(transaction.debit)) : '—'}</td>
            <td class="amount">${transaction.credit ? escapeHtml(formatCurrency(transaction.credit)) : '—'}</td>
            <td class="amount balance">${escapeHtml(formatCurrency(runningBalance))}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="empty">No purchase or payment transactions are recorded for this supplier.</td></tr>';
    const generatedDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Supplier Account Statement</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: A4 portrait; margin: 14mm 13mm; }
        body { margin: 0; padding: 14mm 13mm; color: #202124; background: #fff; font: 9.5pt/1.45 Arial, Helvetica, sans-serif; }
        .document { max-width: 184mm; margin: 0 auto; }
        header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; padding-bottom: 7mm; border-bottom: 2px solid #c58a00; }
        .brand { margin-bottom: 3mm; color: #8b6200; font-size: 9pt; font-weight: 800; letter-spacing: .12em; }
        h1 { margin: 0; font-size: 21pt; line-height: 1.15; }
        .subtitle, .generated, .muted { color: #60646c; }
        .subtitle { margin-top: 2mm; font-size: 9pt; }
        .generated { text-align: right; font-size: 9pt; white-space: nowrap; }
        .party { display: flex; justify-content: space-between; gap: 10mm; margin: 7mm 0; padding: 0 0 5mm; border-bottom: 1px solid #d9dce1; }
        .party-label, .summary-label { display: block; margin-bottom: 1.5mm; color: #60646c; font-size: 7.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
        .party-name { font-size: 13pt; font-weight: 700; }
        .party-phone { align-self: end; text-align: right; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 9mm; border: 1px solid #d9dce1; }
        .summary-card { padding: 4mm; }
        .summary-card + .summary-card { border-left: 1px solid #d9dce1; }
        .summary-value { font-size: 13pt; font-weight: 700; }
        h2 { margin: 0 0 3mm; font-size: 11pt; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        th { padding: 2.5mm 2mm; border-top: 1px solid #737780; border-bottom: 1px solid #737780; color: #42464d; text-align: left; font-size: 7.5pt; letter-spacing: .04em; text-transform: uppercase; }
        td { padding: 3mm 2mm; border-bottom: 1px solid #e1e3e7; text-align: left; vertical-align: top; }
        .date { white-space: nowrap; }
        .amount { text-align: right; white-space: nowrap; }
        .type { display: block; font-weight: 700; }
        .type.payment { color: #486349; }
        .description { display: block; margin-top: .7mm; color: #60646c; font-size: 8pt; }
        .empty { padding: 12mm 2mm; color: #60646c; text-align: center; }
        .closing { margin-top: 8mm; padding-top: 4mm; border-top: 1px solid #d9dce1; color: #60646c; font-size: 8pt; }
        @media print { body { padding: 0; } .document { max-width: none; } tr { break-inside: avoid; } }
      </style></head><body><main class="document">
        <header><div><div class="brand">ABLE LUBES</div><h1>Supplier Account Statement</h1><div class="subtitle">Full purchase and payment history</div></div><div class="generated"><strong>STATEMENT DATE</strong><br>${escapeHtml(generatedDate)}</div></header>
        <section class="party"><div><div class="party-label">Prepared for</div><div class="party-name">${escapeHtml(ledger.supplier.name)}</div></div>${ledger.supplier.phone ? `<div class="party-phone"><div class="party-label">Phone</div><div>${escapeHtml(ledger.supplier.phone)}</div></div>` : ''}</section>
        <section class="summary">
          <div class="summary-card"><span class="summary-label">Total billed</span><strong class="summary-value">${escapeHtml(formatCurrency(Number(ledger.totals.billed)))}</strong></div>
          <div class="summary-card"><span class="summary-label">Total paid</span><strong class="summary-value">${escapeHtml(formatCurrency(Number(ledger.totals.paid)))}</strong></div>
          <div class="summary-card"><span class="summary-label">Balance due</span><strong class="summary-value">${escapeHtml(formatCurrency(Number(ledger.totals.outstanding)))}</strong></div>
        </section>
        <h2>Account activity</h2>
        <table><thead><tr><th>Date</th><th>Transaction</th><th class="amount">Debit</th><th class="amount">Credit</th><th class="amount">Balance</th></tr></thead><tbody>${statementRows}</tbody></table>
        <div class="closing">This statement is generated from the account records available at the time of printing.</div>
      </main></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.onafterprint = () => printWindow.close();
      printWindow.print();
    }, 250);
  };

  const printSupplierPaymentReceipt = (payment: SupplierLedgerPurchase['payments'][number]) => {
    if (!ledger) return;
    const key = payment.paymentGroupId || payment.id;
    const receipt = paymentReceipts.get(key);
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'width=400,height=650');
    if (!printWindow) {
      showToast('Allow pop-ups to print the supplier payment receipt.', 'error');
      return;
    }
    const methods = [...receipt.methods].map((method) =>
      method === 'CASH' ? 'Cash' : method === 'UPI' ? 'UPI' : method,
    ).join(' + ');
    const appliedBills = [...receipt.purchaseNumbers].map((number) =>
      `<div class="line"><span>${escapeHtml(number)}</span></div>`,
    ).join('');
    const receiptHeightMm = Math.ceil(72 + receipt.purchaseNumbers.size * 6);
    const paymentDateValue = new Date(receipt.date);
    const displayDate = Number.isNaN(paymentDateValue.getTime())
      ? String(receipt.date).slice(0, 10)
      : paymentDateValue.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Supplier Payment Receipt</title>
      <style>
        @page { size: 80mm ${receiptHeightMm}mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body { width: 80mm; margin: 0; padding: 0; color: #111; background: #fff; font: 10px/1.4 Arial, Helvetica, sans-serif; }
        body { padding: 3mm; }
        .receipt { width: 74mm; margin: 0 auto; }
        header { padding-bottom: 2.5mm; border-bottom: 1px dashed #555; text-align: center; }
        header h1 { margin: 0; font-size: 16px; letter-spacing: .04em; }
        header p { margin: 1mm 0 0; font-size: 9px; }
        .meta { padding: 2.5mm 0; border-bottom: 1px dashed #555; }
        .line { display: flex; justify-content: space-between; gap: 2mm; margin: 1.5mm 0; overflow-wrap: anywhere; }
        .label { color: #444; }
        .total { margin-top: 2mm; padding: 2.5mm 0; border-top: 1px solid #111; border-bottom: 1px solid #111; font-size: 14px; font-weight: 700; }
        .applied { margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed #555; }
        .applied h2 { margin: 0 0 2mm; font-size: 10px; }
        footer { margin-top: 4mm; padding-top: 2mm; border-top: 1px dashed #555; text-align: center; font-size: 9px; }
        @media screen { body { margin: 12px auto; box-shadow: 0 1px 8px #bbb; } }
      </style></head><body><main class="receipt">
        <header><h1>ABLE LUBES</h1><p>SUPPLIER PAYMENT RECEIPT</p></header>
        <section class="meta">
          <div class="line"><span class="label">Supplier</span><strong>${escapeHtml(ledger.supplier.name)}</strong></div>
          <div class="line"><span class="label">Date</span><span>${escapeHtml(displayDate)}</span></div>
          <div class="line"><span class="label">Payment method</span><strong>${escapeHtml(methods)}</strong></div>
          ${receipt.receiptNumber ? `<div class="line"><span class="label">Receipt number</span><strong>${escapeHtml(receipt.receiptNumber)}</strong></div>` : ''}
        </section>
        <div class="line total"><span>Amount paid</span><span>${escapeHtml(formatCurrency(receipt.amount))}</span></div>
        ${receipt.purchaseNumbers.size ? `<section class="applied"><h2>Applied against</h2>${appliedBills}</section>` : ''}
        <footer>Payment recorded. Keep this receipt for your records.</footer>
      </main><script>window.addEventListener('load', () => setTimeout(() => { window.focus(); window.print(); }, 250));</script></body></html>`);
    printWindow.document.close();
  };

  const submitPayment = async () => {
    if (!authSession || !selectedSupplierId || !ledger || savingPayment) return;
    const cashAmount = Number(cashPaymentAmount) || 0;
    const upiAmount = Number(upiPaymentAmount) || 0;
    const amount = cashAmount + upiAmount;
    const outstanding = Number(ledger.totals.outstanding);
    const oldestDuePurchase = ledger.purchases.find((purchase) => Number(purchase.outstanding) > 0);
    if (!oldestDuePurchase || !Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      showToast('Enter a payment greater than zero and no more than this supplier’s total outstanding balance.', 'error');
      return;
    }
    setSavingPayment(true);
    try {
      const tenders = [
        ...(cashAmount > 0 ? [{ method: 'CASH' as const, amount: cashAmount }] : []),
        ...(upiAmount > 0 ? [{ method: 'UPI' as const, amount: upiAmount }] : []),
      ];
      await createSupplierPaymentRequest(authSession.token, {
        supplierId: selectedSupplierId,
        purchaseId: oldestDuePurchase.id,
        tenders,
        paymentDate,
        ...(receiptNumber.trim() ? { receiptNumber: receiptNumber.trim() } : {}),
      });
      await reloadLedger();
      setPaymentOpen(false);
      setCashPaymentAmount('');
      setUpiPaymentAmount('');
      setReceiptNumber('');
      showToast('Payment recorded and applied to the oldest outstanding bills first.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to record the supplier payment.', 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <div className="daily-register-page w-full">
      <div className="daily-register-screen flex w-full flex-col gap-4">
        {(supplierError || ledgerError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{supplierError || ledgerError}</p>}

        <section className="overflow-hidden rounded-2xl border border-[#e9e3d9] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#efede8] bg-gradient-to-r from-[#fff8e7] via-[#fffdf8] to-white px-5 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0"><div className="flex items-center gap-1.5"><h2 className="truncate text-lg font-bold text-[#272727]">{ledger?.supplier.name || selectedSupplier?.name || 'Supplier ledger'}</h2>{selectedSupplier && <button type="button" aria-label={`Edit ${selectedSupplier.name}`} title="Edit supplier" onClick={() => editSupplier(selectedSupplier)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#765000] transition hover:bg-[#fff1c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c58a00]"><Pencil size={14} /></button>}</div><p className="mt-0.5 text-sm text-[#77736d]">{ledger?.supplier.phone || selectedSupplier?.phone || ''}</p></div>
            </div>
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label className="flex min-w-[230px] flex-1 flex-col gap-1.5 text-xs font-semibold text-[#77736d] sm:flex-none">
                Select supplier
                <select value={selectedSupplierId} disabled={supplierLoading || suppliers.length === 0} onChange={(event) => setSelectedSupplierId(event.target.value)} className="h-11 w-full rounded-lg border border-[#e5d3a7] bg-white px-3 text-sm font-semibold text-[#272727] shadow-sm outline-none focus:border-[#c58a00] sm:min-w-[250px]">
                  <option value="">{supplierLoading ? 'Loading suppliers…' : suppliers.length ? 'Choose a supplier' : 'No suppliers available'}</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => { resetSupplierForm(); setSupplierModalOpen(true); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ffe4a0] px-3 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82]"><Plus size={16} />Add supplier</button>
              {selectedSupplier && <>
                <button type="button" disabled={!ledger || ledgerLoading} onClick={printSupplierLedger} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#eadfc8] bg-white px-3 text-sm font-semibold text-[#765000] shadow-sm hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50"><Printer size={15} />Print / Save PDF</button>
                <button type="button" onClick={() => void removeSupplier(selectedSupplier)} className="h-11 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50">Deactivate</button>
              </>}
              <button type="button" disabled={!ledger || Number(ledger.totals.outstanding) <= 0 || ledgerLoading} onClick={() => { setCashPaymentAmount(String(Number(ledger?.totals.outstanding || 0))); setUpiPaymentAmount(''); setPaymentDate(localToday()); setReceiptNumber(''); setPaymentOpen(true); }} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#c58a00] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a97000] disabled:cursor-not-allowed disabled:opacity-45"><Wallet size={16} />Record payment</button>
            </div>
          </div>

          {supplierLoading && !selectedSupplier && <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center text-sm text-[#77736d]"><LoaderOne /><span>Loading suppliers…</span></div>}
          {!selectedSupplier && !supplierLoading && <div className="flex items-center justify-center px-5 py-14 text-center text-sm text-[#77736d]">Select a supplier to see their outstanding</div>}
          {selectedSupplier && ledgerLoading && <div className="flex flex-col items-center justify-center gap-3 p-14 text-sm text-[#77736d]"><LoaderOne /><span>Loading supplier ledger…</span></div>}
          {selectedSupplier && !ledgerLoading && ledger && (
            <>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {[
                  { label: 'Total billed', value: ledger.totals.billed, icon: FileText, tone: 'bg-[#fff8e7] text-[#9a6700]' },
                  { label: 'Total paid', value: ledger.totals.paid, icon: CreditCard, tone: 'bg-[#f4f7f2] text-[#4c6b45]' },
                  { label: 'Outstanding', value: ledger.totals.outstanding, icon: Wallet, tone: 'bg-[#fff2e9] text-[#a45520]' },
                ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-[#eee8df] bg-[#fffdfa] p-4 shadow-[0_2px_8px_rgba(37,27,12,.04)]"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={20} /></span><div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">{label}</div><div className={`mt-1 truncate text-xl font-bold ${label === 'Outstanding' ? 'text-[#a86600]' : 'text-[#272727]'}`}>{formatCurrency(Number(value))}</div></div></div>)}
              </div>
              <div className="flex items-center justify-between border-y border-[#efede8] px-5 py-3"><div className="flex items-center gap-2"><Package size={17} className="text-[#a86600]" /><h3 className="font-semibold text-[#272727]">Purchase history</h3></div><span className="rounded-full bg-[#f6f5f2] px-2.5 py-1 text-xs font-semibold text-[#77736d]">{ledger.purchases.length} bills</span></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead><tr className="h-11 bg-[#f8f7f4] text-xs font-bold uppercase tracking-wide text-[#6d685f]">{['Purchase / date', 'Total (₹)', 'Paid (₹)', 'Outstanding (₹)', 'Payments'].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                    {pageLedgerPurchases.map((purchase) => (
                      <tr key={purchase.id} className="align-top transition-colors hover:bg-[#fffdf8]">
                        <td className="px-3 py-3"><span className="block font-semibold text-[#a86600]">{purchase.supplierInvoiceNumber || purchase.purchaseNumber}</span><span className="mt-1 block text-xs text-[#77736d]">{String(purchase.date).slice(0, 10)}</span></td>
                        <td className="px-3 py-3 font-semibold">{formatCurrency(Number(purchase.total))}</td>
                        <td className="px-3 py-3">{formatCurrency(Number(purchase.paid))}</td>
                        <td className={`px-3 py-3 font-semibold ${Number(purchase.outstanding) > 0 ? 'text-[#a86600]' : 'text-[#77736d]'}`}>{formatCurrency(Number(purchase.outstanding))}</td>
                        <td className="min-w-[170px] px-3 py-3">{purchase.payments.length ? purchase.payments.map((payment) => {
                          const receipt = paymentReceipts.get(payment.paymentGroupId || payment.id);
                          return <div key={payment.id} className="mb-1 flex items-center gap-1.5 text-xs text-[#68645e] last:mb-0"><span>{String(payment.date).slice(0, 10)} · {payment.method} · {formatCurrency(Number(payment.amount))}{payment.receiptNumber ? <span className="block font-medium text-[#765000]">Receipt # {payment.receiptNumber}</span> : null}</span>{receipt && receipt.firstPaymentId === payment.id && <button type="button" onClick={() => printSupplierPaymentReceipt(payment)} aria-label={`Print payment receipt for ${formatCurrency(receipt.amount)}`} title="Print payment receipt" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#765000] hover:bg-[#fff1c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c58a00]"><Printer size={14} /></button>}</div>;
                        }) : <span className="text-[#77736d]">—</span>}</td>
                      </tr>
                    ))}
                    {ledger.purchases.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[#77736d]">No purchase or payment records for this supplier.</td></tr>}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-col gap-3 border-t border-[#efede8] bg-[#f8f7f4] px-4 py-3 text-xs text-[#77736d] sm:flex-row sm:items-center sm:justify-between">
                <span>Showing <strong className="text-[#272727]">{purchaseRange.start}-{purchaseRange.end}</strong> of <strong className="text-[#272727]">{newestFirstPurchases.length}</strong> purchases</span>
                <PaginationControls totalRecords={newestFirstPurchases.length} page={safePurchasePage} onPageChange={setPurchasePage} />
              </footer>
            </>
          )}
        </section>
      </div>

      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150" onClick={() => { if (!savingSupplier) resetSupplierForm(); }}>
          <form role="dialog" aria-modal="true" aria-labelledby="supplier-modal-title" onSubmit={submitSupplier} onClick={(event) => event.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#e9e3d9] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#efede8] bg-gradient-to-r from-[#fff8e7] to-white px-5 py-4">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0c7] text-[#a86600]"><Building2 size={20} /></span><h2 id="supplier-modal-title" className="text-lg font-semibold text-[#272727]">{editingSupplierId ? 'Edit supplier' : 'Add supplier'}</h2></div>
              <button type="button" aria-label="Close" disabled={savingSupplier} onClick={resetSupplierForm} className="rounded-lg px-2 py-1 text-lg text-[#77736d] transition hover:bg-[#f6f5f2] disabled:opacity-50">×</button>
            </div>
            <div className="grid gap-4 p-5">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Supplier name
                <input required autoFocus value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Business or person name" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Phone number
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))} onPaste={(event) => { event.preventDefault(); setPhone(event.clipboardData.getData('text').replace(/\D/g, '')); }} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Optional" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Address
                <input required value={address} onChange={(event) => setAddress(event.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Supplier address" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#efede8] bg-[#fffdfa] px-5 py-4">
              <button type="button" disabled={savingSupplier} onClick={resetSupplierForm} className="h-10 rounded-lg border border-[#e9e3d9] bg-white px-4 text-sm font-semibold text-[#555] shadow-sm hover:bg-[#f8f6f2] disabled:opacity-50">Cancel</button>
              <button disabled={savingSupplier} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82] disabled:opacity-60" type="submit">
                {savingSupplier ? <LoaderCircle size={16} className="animate-spin" /> : editingSupplierId ? <Pencil size={16} /> : <Plus size={17} />}
                {savingSupplier ? 'Saving…' : editingSupplierId ? 'Update supplier' : 'Save supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {paymentOpen && ledger && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!savingPayment) setPaymentOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-[#e9e3d9] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between"><div><h3 className="text-lg font-bold text-[#272727]">Record supplier payment</h3><p className="mt-1 text-sm text-[#77736d]">{selectedSupplier.name}</p></div><button type="button" disabled={savingPayment} onClick={() => setPaymentOpen(false)} className="rounded-lg px-2 py-1 text-[#77736d] hover:bg-[#f6f5f2]">✕</button></div>
            <div className="mb-4 rounded-lg bg-[#fbf7ed] p-3 text-sm"><span className="text-[#77736d]">Total outstanding </span><strong>{formatCurrency(Number(ledger.totals.outstanding))}</strong><p className="mt-1 text-xs text-[#77736d]">Payment is allocated to the oldest outstanding bills first.</p></div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">Cash amount (₹)<NumericTextInput min="0" max={Number(ledger.totals.outstanding)} value={cashPaymentAmount} onValueChange={setCashPaymentAmount} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]" /></label>
                <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">UPI amount (₹)<NumericTextInput min="0" max={Number(ledger.totals.outstanding)} value={upiPaymentAmount} onValueChange={setUpiPaymentAmount} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]" /></label>
              </div>
              <p className="text-xs text-[#77736d]">Enter either amount or both. Total payment: {formatCurrency((Number(cashPaymentAmount) || 0) + (Number(upiPaymentAmount) || 0))}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">Payment date<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]" /></label>
                <div className="flex items-end text-xs text-[#77736d]">Allocated oldest outstanding first.</div>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">Receipt Number <span className="font-normal text-xs text-[#77736d]">Optional</span><input type="text" value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} maxLength={120} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]" placeholder="Enter receipt number" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[#efede8] pt-3"><button type="button" disabled={savingPayment} onClick={() => setPaymentOpen(false)} className="h-10 rounded-lg border border-[#e9e3d9] px-4 text-sm font-semibold text-[#555]">Cancel</button><button type="button" disabled={savingPayment} onClick={() => void submitPayment()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm disabled:opacity-60">{savingPayment && <LoaderCircle size={15} className="animate-spin" />}{savingPayment ? 'Saving…' : 'Save payment'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
