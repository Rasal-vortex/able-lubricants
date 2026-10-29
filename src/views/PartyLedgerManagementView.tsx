import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

export const PartyLedgerManagementView: React.FC = () => {
  const { customers, suppliers, partyLedger, supplierLedger, addSupplier, updateSupplier, deactivateSupplier, supplierLoading, supplierError, addCustomer, updateCustomer, deactivateCustomer, customerLoading, customerError, recordPartyPayment, recordSupplierPayment, showToast } = useApp();
  const [tab, setTab] = useState<'customers' | 'suppliers' | 'customer-ledger' | 'supplier-ledger'>('customers');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partySaving, setPartySaving] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const isSupplier = tab === 'suppliers' || tab === 'supplier-ledger';
  const ledger = isSupplier ? supplierLedger : partyLedger;
  const currentInvoices = ledger.filter(entry => entry.transactionType === 'INVOICES' && entry.outstandingBalance > 0);
  const selectedInvoice = currentInvoices.find(entry => entry.invoiceNumber === invoiceNumber);
  const visibleLedger = ledger.filter(entry => {
    const rawDate = entry.transactionType === 'PAYMENTS' ? entry.paymentDate : entry.invoiceDate;
    const parsed = new Date(rawDate);
    const date = rawDate === '-' || /^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(parsed.getTime()) ? rawDate : new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return (partyFilter === 'ALL' || entry.partyName === partyFilter) && (!from || date >= from) && (!to || date <= to);
  });
  const parties = isSupplier ? suppliers : customers;
  const partyBalances = useMemo(() => parties.map(party => ({
    ...party,
    invoices: ledger.filter(row => row.partyName === party.name && row.transactionType === 'INVOICES'),
    due: ledger.filter(row => row.partyName === party.name && row.transactionType === 'INVOICES').reduce((sum,row) => sum + row.outstandingBalance, 0),
    total: ledger.filter(row => row.partyName === party.name && row.transactionType === 'INVOICES').reduce((sum,row) => sum + row.billAmount, 0),
  })), [parties, ledger]);

  const openPayment = (entry?: { invoiceNumber: string; partyName: string; outstandingBalance: number }) => {
    const invoice = entry || currentInvoices[0];
    if (!invoice) { showToast('There are no outstanding invoices to pay.', 'info'); return; }
    setPartyName(invoice.partyName); setInvoiceNumber(invoice.invoiceNumber); setAmount(String(invoice.outstandingBalance)); setPaymentDate(todayIso()); setModalOpen(true);
  };
  const resetPartyForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setEditingPartyId(null);
  };
  const submitParty = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setPartySaving(true);
    try {
      if (isSupplier) {
        const payload = { name: name.trim(), phone: phone.trim(), address: address.trim() };
        if (editingPartyId) await updateSupplier(editingPartyId, payload);
        else await addSupplier(payload);
      } else if (editingPartyId) {
        await updateCustomer(editingPartyId, { name: name.trim(), phone: phone.trim(), address: address.trim() });
      } else {
        await addCustomer({ name: name.trim(), phone: phone.trim(), address: address.trim() });
      }
      resetPartyForm();
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Unable to save the ${isSupplier ? 'supplier' : 'customer'}.`, 'error');
    } finally {
      setPartySaving(false);
    }
  };
  const editParty = (party: (typeof customers)[number]) => {
    setEditingPartyId(party.id);
    setName(party.name);
    setPhone(party.phone);
    setAddress(party.address || '');
  };
  const removeParty = async (party: (typeof customers)[number]) => {
    const partyType = isSupplier ? 'supplier' : 'customer';
    if (!window.confirm(`Deactivate ${party.name}? They will no longer appear in ${partyType} selection.`)) return;
    try {
      if (isSupplier) await deactivateSupplier(party.id);
      else await deactivateCustomer(party.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Unable to deactivate the ${partyType}.`, 'error');
    }
  };
  const savePayment = async () => {
    const value = Number(amount);
    if (!partyName || !invoiceNumber || !Number.isFinite(value) || value <= 0 || !selectedInvoice || value > selectedInvoice.outstandingBalance) {
      showToast('Choose an unpaid invoice and enter a valid amount within its balance.', 'error'); return;
    }
    if (isSupplier) {
      const saved = await recordSupplierPayment(invoiceNumber, partyName, value, paymentDate, paymentMode);
      if (!saved) return;
    } else {
      recordPartyPayment(invoiceNumber, partyName, value, paymentDate, paymentMode);
    }
    setModalOpen(false);
  };
  const exportCsv = () => {
    const rows = [['Party','Invoice','Date','Bill amount (INR)','Paid (INR)','Outstanding (INR)','Type'], ...visibleLedger.map(row => [row.partyName,row.invoiceNumber,row.invoiceDate,formatCurrency(row.billAmount),formatCurrency(row.amountPaid),formatCurrency(row.outstandingBalance),row.transactionType])];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); link.download = `${isSupplier?'supplier':'customer'}-ledger-${todayIso()}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast('Ledger exported.');
  };
  const tabs: Array<[typeof tab,string]> = [['customers','Customers'],['suppliers','Suppliers'],['customer-ledger','Customer ledger'],['supplier-ledger','Supplier ledger']];

  return <div className="flex flex-col w-full gap-space-md">
    <div className="flex flex-wrap items-center justify-between gap-space-sm"><div className="flex flex-wrap gap-1 bg-surface-container-low p-1 rounded-lg">{tabs.map(([key,label])=><button key={key} type="button" onClick={()=>{setTab(key);setPartyFilter('ALL');resetPartyForm();}} className={`px-space-sm py-2 rounded font-label-md ${tab===key?'bg-primary-container text-on-primary':'text-on-surface-variant hover:text-on-surface'}`}>{label}</button>)}</div>
      {(tab.endsWith('ledger')) && <div className="flex gap-space-xs"><button type="button" onClick={exportCsv} className="h-9 px-space-md rounded border border-outline-variant/30 bg-surface-container-lowest text-on-surface">Export CSV</button><button type="button" onClick={()=>openPayment()} className="h-9 px-space-md rounded bg-primary-container text-on-primary">Record payment</button></div>}
    </div>
    {!tab.endsWith('ledger') ? <>
      <form onSubmit={submitParty} className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/20 flex flex-wrap gap-space-sm items-end">
        <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">{isSupplier ? 'Supplier' : 'Customer'} name<input required value={name} onChange={e => setName(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" placeholder="Business or person name" /></label>
        <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Phone<input value={phone} onChange={e => setPhone(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" placeholder="Optional" /></label>
        <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Address<input required value={address} onChange={e => setAddress(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" placeholder={`${isSupplier ? 'Supplier' : 'Customer'} address`} /></label>
        <button disabled={partySaving} className="h-9 px-space-md rounded bg-primary-container text-on-primary disabled:opacity-60" type="submit">{partySaving ? 'Saving…' : editingPartyId ? `Update ${isSupplier ? 'supplier' : 'customer'}` : `Add ${isSupplier ? 'supplier' : 'customer'}`}</button>
        {editingPartyId && <button className="h-9 px-space-md rounded border border-outline-variant/30 text-on-surface" type="button" onClick={resetPartyForm}>Cancel</button>}
      </form>
      {(isSupplier ? supplierError : customerError) && <p role="alert" className="rounded-md bg-error-container p-3 text-on-error-container">{isSupplier ? 'Suppliers' : 'Customers'} could not be loaded: {isSupplier ? supplierError : customerError}</p>}
      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/20 overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-surface-container-low">{['Name','Phone','Address','Actions'].map(h=><th key={h} className="px-space-md py-3 text-label-sm uppercase text-on-surface-variant">{h}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant/10">
        {(isSupplier ? supplierLoading : customerLoading) && <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant">Loading {isSupplier ? 'suppliers' : 'customers'}…</td></tr>}
        {partyBalances.map(p=><tr key={p.id}><td className="px-space-md py-3 font-medium text-on-surface">{p.name}</td><td className="px-space-md py-3 text-on-surface-variant">{p.phone||'—'}</td><td className="px-space-md py-3 text-on-surface-variant">{p.address || '—'}</td><td className="px-space-md py-3 whitespace-nowrap"><button type="button" onClick={() => editParty(p)} className="mr-3 text-primary">Edit</button><button type="button" onClick={() => void removeParty(p)} className="text-error">Deactivate</button></td></tr>)}
        {!(isSupplier ? supplierLoading : customerLoading) && !partyBalances.length && <tr><td colSpan={4} className="p-8 text-center text-on-surface-variant">No records yet.</td></tr>}
      </tbody></table></div>
    </> : <>
      <section className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/20 flex flex-wrap gap-space-sm items-end"><label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Party<select value={partyFilter} onChange={e=>setPartyFilter(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 bg-surface-container-lowest text-on-surface"><option value="ALL">All {isSupplier?'suppliers':'customers'}</option>{parties.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></label><label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" /></label><label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">To<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" /></label><button type="button" onClick={()=>{setFrom('');setTo('');setPartyFilter('ALL');}} className="h-9 px-space-md rounded border border-outline-variant/30 text-on-surface">Reset</button></section>
      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/20 overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-surface-container-low">{['Party','Reference','Date','Type','Bill amount (₹)','Paid (₹)','Balance (₹)',''].map(h=><th key={h} className="px-space-md py-3 text-label-sm uppercase text-on-surface-variant">{h}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant/10">{visibleLedger.map(row=><tr key={row.id}><td className="px-space-md py-3 text-on-surface">{row.partyName}</td><td className="px-space-md py-3 font-mono text-primary">{row.invoiceNumber}</td><td className="px-space-md py-3 text-on-surface-variant">{row.transactionType==='PAYMENTS'?row.paymentDate:row.invoiceDate}</td><td className="px-space-md py-3 text-on-surface">{row.transactionType==='INVOICES'?'Invoice':'Payment'}{row.paymentMode?` · ${row.paymentMode}`:''}</td><td className="px-space-md py-3 text-on-surface">{formatCurrency(row.billAmount)}</td><td className="px-space-md py-3 text-on-surface">{formatCurrency(row.amountPaid)}</td><td className="px-space-md py-3 text-on-surface">{formatCurrency(row.outstandingBalance)}</td><td className="px-space-md py-3">{row.transactionType==='INVOICES'&&row.outstandingBalance>0&&<button type="button" onClick={()=>openPayment(row)} className="text-primary">Pay</button>}</td></tr>)}{!visibleLedger.length&&<tr><td colSpan={8} className="p-8 text-center text-on-surface-variant">No ledger entries match the selected filters.</td></tr>}</tbody></table></div>
    </>}
    {modalOpen&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={()=>setModalOpen(false)}><div className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-space-md flex flex-col gap-space-sm" onClick={e=>e.stopPropagation()}><h2 className="font-title-md text-on-surface">Record {isSupplier?'supplier payment':'customer receipt'}</h2><label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">Invoice<select value={invoiceNumber} onChange={e=>{const row=currentInvoices.find(r=>r.invoiceNumber===e.target.value);setInvoiceNumber(e.target.value);if(row){setPartyName(row.partyName);setAmount(String(row.outstandingBalance));}}} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface">{currentInvoices.map(row=><option key={row.id} value={row.invoiceNumber}>{row.partyName} · {row.invoiceNumber} · {formatCurrency(row.outstandingBalance)} due</option>)}</select></label><div className="text-label-sm text-on-surface-variant">{partyName} · Remaining balance {formatCurrency(selectedInvoice?.outstandingBalance||0)}</div><label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">Amount (₹)<input type="number" min="0.01" step="0.01" max={selectedInvoice?.outstandingBalance} value={amount} onChange={e=>setAmount(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" /></label><label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">Payment date<input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface" /></label><label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">Method<select value={paymentMode} onChange={e=>setPaymentMode(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 text-on-surface">{['Cash','UPI','Bank transfer','Cheque'].map(m=><option key={m}>{m}</option>)}</select></label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>setModalOpen(false)} className="h-9 px-space-md rounded border border-outline-variant/30">Cancel</button><button type="button" onClick={savePayment} className="h-9 px-space-md rounded bg-primary-container text-on-primary">Save payment</button></div></div></div>}
  </div>;
};
