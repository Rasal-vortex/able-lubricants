import React, { useEffect, useState } from 'react';
import { Building2, CreditCard, FileText, LoaderCircle, Package, Pencil, Plus, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { createSupplierPaymentRequest, getSupplierLedgerReport } from '../services/api';
import { formatCurrency } from '../utils/currency';

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
  }>;
};

type SupplierLedger = {
  supplier: { id: string; name: string; phone?: string | null };
  totals: { billed: string | number; paid: string | number; outstanding: string | number };
  purchases: SupplierLedgerPurchase[];
};

const localToday = () => {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

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
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localToday);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [savingPayment, setSavingPayment] = useState(false);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);

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

  const submitPayment = async () => {
    if (!authSession || !selectedSupplierId || !ledger || savingPayment) return;
    const amount = Number(paymentAmount);
    const outstanding = Number(ledger.totals.outstanding);
    const oldestDuePurchase = ledger.purchases.find((purchase) => Number(purchase.outstanding) > 0);
    if (!oldestDuePurchase || !Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      showToast('Enter a payment greater than zero and no more than this supplier’s total outstanding balance.', 'error');
      return;
    }
    setSavingPayment(true);
    try {
      await createSupplierPaymentRequest(authSession.token, {
        supplierId: selectedSupplierId,
        purchaseId: oldestDuePurchase.id,
        amount,
        method: paymentMethod,
        paymentDate,
      });
      await reloadLedger();
      setPaymentOpen(false);
      setPaymentAmount('');
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
              <div className="min-w-0"><h2 className="truncate text-lg font-bold text-[#272727]">{ledger?.supplier.name || selectedSupplier?.name || 'Supplier ledger'}</h2><p className="mt-0.5 text-sm text-[#77736d]">{ledger?.supplier.phone || selectedSupplier?.phone || ''}</p></div>
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
                <button type="button" onClick={() => editSupplier(selectedSupplier)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#eadfc8] bg-white px-3 text-sm font-semibold text-[#765000] shadow-sm hover:bg-[#fffaf0]"><Pencil size={15} />Edit</button>
                <button type="button" onClick={() => void removeSupplier(selectedSupplier)} className="h-11 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50">Deactivate</button>
              </>}
              <button type="button" disabled={!ledger || Number(ledger.totals.outstanding) <= 0 || ledgerLoading} onClick={() => { setPaymentAmount(String(ledger?.totals.outstanding || '')); setPaymentDate(localToday()); setPaymentMethod('CASH'); setPaymentOpen(true); }} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#c58a00] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a97000] disabled:cursor-not-allowed disabled:opacity-45"><Wallet size={16} />Record payment</button>
            </div>
          </div>

          {!selectedSupplier && !supplierLoading && <div className="flex items-center justify-center px-5 py-14 text-center text-sm text-[#77736d]">Select a supplier to see their outstanding</div>}
          {selectedSupplier && ledgerLoading && <div className="flex items-center justify-center gap-2 p-14 text-sm text-[#77736d]"><LoaderCircle size={18} className="animate-spin" />Loading supplier ledger…</div>}
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
                <table className="w-full min-w-[850px] border-collapse text-left">
                  <thead><tr className="h-11 bg-[#f8f7f4] text-xs font-bold uppercase tracking-wide text-[#6d685f]">{['Purchase / date', 'Purchased items', 'Total (₹)', 'Paid (₹)', 'Outstanding (₹)', 'Payments'].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                    {ledger.purchases.map((purchase) => (
                      <tr key={purchase.id} className="align-top transition-colors hover:bg-[#fffdf8]">
                        <td className="px-3 py-3"><span className="block font-semibold text-[#a86600]">{purchase.supplierInvoiceNumber || purchase.purchaseNumber}</span><span className="mt-1 block text-xs text-[#77736d]">{String(purchase.date).slice(0, 10)}</span></td>
                        <td className="max-w-[360px] px-3 py-3">{purchase.items.length ? purchase.items.map((item) => <div key={item.id} className="mb-1 last:mb-0"><span className="font-medium">{item.productName}</span><span className="block text-xs text-[#77736d]">{item.quantity} {item.unitName || ''} × {formatCurrency(Number(item.purchaseRate))} = {formatCurrency(Number(item.lineTotal))}</span></div>) : <span className="text-[#77736d]">No item details</span>}</td>
                        <td className="px-3 py-3 font-semibold">{formatCurrency(Number(purchase.total))}</td>
                        <td className="px-3 py-3">{formatCurrency(Number(purchase.paid))}</td>
                        <td className={`px-3 py-3 font-semibold ${Number(purchase.outstanding) > 0 ? 'text-[#a86600]' : 'text-[#77736d]'}`}>{formatCurrency(Number(purchase.outstanding))}</td>
                        <td className="min-w-[170px] px-3 py-3">{purchase.payments.length ? purchase.payments.map((payment) => <div key={payment.id} className="mb-1 last:mb-0 text-xs text-[#68645e]">{String(payment.date).slice(0, 10)} · {payment.method} · {formatCurrency(Number(payment.amount))}</div>) : <span className="text-[#77736d]">—</span>}</td>
                      </tr>
                    ))}
                    {ledger.purchases.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#77736d]">No purchase or payment records for this supplier.</td></tr>}
                  </tbody>
                </table>
              </div>
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
              <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">Amount (₹)<input type="number" min="0.01" max={Number(ledger.totals.outstanding)} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">Payment date<input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]" /></label>
                <label className="flex flex-col gap-1 text-sm font-medium text-[#68645e]">Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as 'CASH' | 'UPI')} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00]"><option value="CASH">Cash</option><option value="UPI">UPI</option></select></label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[#efede8] pt-3"><button type="button" disabled={savingPayment} onClick={() => setPaymentOpen(false)} className="h-10 rounded-lg border border-[#e9e3d9] px-4 text-sm font-semibold text-[#555]">Cancel</button><button type="button" disabled={savingPayment} onClick={() => void submitPayment()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm disabled:opacity-60">{savingPayment && <LoaderCircle size={15} className="animate-spin" />}{savingPayment ? 'Saving…' : 'Save payment'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
