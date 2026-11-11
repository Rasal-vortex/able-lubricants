import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';

export const PartyLedgerManagementView: React.FC = () => {
  const {
    customers, suppliers, addSupplier, updateSupplier, deactivateSupplier, supplierLoading, supplierError,
    addCustomer, updateCustomer, deactivateCustomer, customerLoading, customerError, showToast,
    setActiveScreen, setCreditBillPartyTarget,
  } = useApp();
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partySaving, setPartySaving] = useState(false);
  const isSupplier = tab === 'suppliers';
  const parties = isSupplier ? suppliers : customers;
  const loading = isSupplier ? supplierLoading : customerLoading;
  const error = isSupplier ? supplierError : customerError;

  const resetPartyForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setEditingPartyId(null);
  };

  const submitParty = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), phone: phone.replace(/\D/g, ''), address: address.trim() };
    setPartySaving(true);
    try {
      if (isSupplier) {
        if (editingPartyId) await updateSupplier(editingPartyId, payload);
        else await addSupplier(payload);
      } else if (editingPartyId) {
        await updateCustomer(editingPartyId, payload);
      } else {
        await addCustomer(payload);
      }
      resetPartyForm();
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : `Unable to save the ${isSupplier ? 'supplier' : 'customer'}.`, 'error');
    } finally {
      setPartySaving(false);
    }
  };

  const editParty = (party: (typeof customers)[number]) => {
    setEditingPartyId(party.id);
    setName(party.name);
    setPhone(party.phone.replace(/\D/g, ''));
    setAddress(party.address || '');
  };

  const removeParty = async (party: (typeof customers)[number]) => {
    const partyType = isSupplier ? 'supplier' : 'customer';
    if (!window.confirm(`Deactivate ${party.name}? They will no longer appear in ${partyType} selection.`)) return;
    try {
      if (isSupplier) await deactivateSupplier(party.id);
      else await deactivateCustomer(party.id);
    } catch (removeError) {
      showToast(removeError instanceof Error ? removeError.message : `Unable to deactivate the ${partyType}.`, 'error');
    }
  };

  const viewPartyCredits = (partyName: string) => {
    setCreditBillPartyTarget({ type: isSupplier ? 'suppliers' : 'customers', name: partyName });
    setActiveScreen('credit-bill-management');
  };

  return (
    <div className="daily-register-page w-full">
      <div className="daily-register-screen flex w-full flex-col gap-4">
        <div role="tablist" aria-label="Party records" className="inline-flex w-fit max-w-full items-center rounded-full border border-[#e9e3d9] bg-white p-1 shadow-[0_3px_12px_rgba(37,27,12,.08)]">
          {([['customers', 'Customers'], ['suppliers', 'Suppliers']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); resetPartyForm(); }} className={`relative inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${tab === key ? 'text-[#493819]' : 'text-[#6b665c] hover:text-[#272727]'}`}>
              {tab === key && <motion.span layoutId="party-ledger-tab-indicator" className="absolute inset-0 rounded-full bg-[#fff1c9] shadow-sm" transition={{ duration: 0.24, ease: 'easeOut' }} aria-hidden="true" />}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={submitParty} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e9e3d9] bg-white p-3 shadow-sm">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-xs font-semibold text-[#77736d]">
            {isSupplier ? 'Supplier name' : 'Customer name'}
            <input required value={name} onChange={event => setName(event.target.value)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Business or person name" />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1.5 text-xs font-semibold text-[#77736d]">
            Phone
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, ''))} onPaste={event => { event.preventDefault(); setPhone(event.clipboardData.getData('text').replace(/\D/g, '')); }} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Optional" />
          </label>
          <label className="flex min-w-[220px] flex-[1.4] flex-col gap-1.5 text-xs font-semibold text-[#77736d]">
            Address
            <input required value={address} onChange={event => setAddress(event.target.value)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder={`${isSupplier ? 'Supplier' : 'Customer'} address`} />
          </label>
          <div className="flex gap-2">
            <button disabled={partySaving} className="h-10 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82] disabled:cursor-not-allowed disabled:opacity-60" type="submit">{partySaving ? 'Saving…' : editingPartyId ? `Update ${isSupplier ? 'supplier' : 'customer'}` : `Add ${isSupplier ? 'supplier' : 'customer'}`}</button>
            {editingPartyId && <button className="h-10 rounded-lg border border-[#e9e3d9] bg-white px-4 text-sm font-semibold text-[#555] shadow-sm hover:bg-[#f8f6f2]" type="button" onClick={resetPartyForm}>Cancel</button>}
          </div>
        </form>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{isSupplier ? 'Suppliers' : 'Customers'} could not be loaded: {error}</p>}
        <section className="overflow-hidden rounded-xl border border-[#e9e3d9] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead><tr className="h-10 bg-[#f6f5f2] text-xs font-bold uppercase tracking-wide text-[#6d685f]">
                {[isSupplier ? 'Supplier' : 'Customer', 'Phone', 'Address', 'Actions'].map(header => <th key={header} className="px-4 py-2">{header}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                {loading && <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-[#77736d]">Loading {isSupplier ? 'suppliers' : 'customers'}…</td></tr>}
                {!loading && parties.map(party => (
                  <tr key={party.id} className="h-12 transition hover:bg-[#fffdf8]">
                    <td className="px-4 py-3 font-semibold text-[#a86600]">{party.name}</td>
                    <td className="px-4 py-3 text-[#68645e]">{party.phone || '—'}</td>
                    <td className="px-4 py-3 text-[#68645e]">{party.address || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><button type="button" onClick={() => viewPartyCredits(party.name)} className="mr-3 text-sm font-semibold text-[#a86600] hover:underline">View credits</button><button type="button" onClick={() => editParty(party)} className="mr-3 text-sm font-semibold text-[#a86600] hover:underline">Edit</button><button type="button" onClick={() => void removeParty(party)} className="text-sm font-semibold text-[#b42318] hover:underline">Deactivate</button></td>
                  </tr>
                ))}
                {!loading && !parties.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-[#77736d]">No records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
