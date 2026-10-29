import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Expense } from '../types';
import { formatCurrency } from '../utils/currency';

export const ExpenseManagementView: React.FC = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, showToast, setActiveReceiptToPrint } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [activePeriod, setActivePeriod] = useState<'month' | 'custom'>('month');
  const now = new Date();
  const localIso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(localIso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [toDate, setToDate] = useState(localIso(now));

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [expenseDate, setExpenseDate] = useState(localIso(now));
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('General');
  const [expenseMethod, setExpenseMethod] = useState('Cash');
  const [expenseNotes, setExpenseNotes] = useState('');

  const filteredExpenses = expenses.filter((e) => {
    const q = searchTerm.toLowerCase().trim();
    const date = e.date.slice(0, 10);
    const inPeriod = date >= fromDate && date <= toDate;
    return inPeriod && (!q || e.description.toLowerCase().includes(q) || (e.category && e.category.toLowerCase().includes(q)));
  });

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setExpenseDate(localIso(new Date()));
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseCategory('General'); setExpenseMethod('Cash'); setExpenseNotes('');
    setModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setModalMode('edit');
    setEditingId(expense.id);
    setExpenseDate(expense.date);
    setExpenseDesc(expense.description);
    setExpenseAmount(expense.amount.toString());
    setExpenseCategory(expense.category || 'General'); setExpenseMethod(expense.paymentMethod || 'Cash'); setExpenseNotes(expense.notes || '');
    setModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseAmount);
    if (!expenseDesc.trim() || isNaN(amt) || amt <= 0) {
      showToast('Please provide valid description and positive amount.', 'error');
      return;
    }

    if (modalMode === 'add') {
      addExpense({
        date: expenseDate,
        description: expenseDesc.trim(),
        amount: amt,
        category: expenseCategory,
        paymentMethod: expenseMethod,
        notes: expenseNotes.trim(),
      });
    } else if (editingId) {
      updateExpense(editingId, {
        date: expenseDate,
        description: expenseDesc.trim(),
        amount: amt,
        category: expenseCategory,
        paymentMethod: expenseMethod,
        notes: expenseNotes.trim(),
      });
    }

    setModalOpen(false);
  };

  const handleViewReceipt = (expense: Expense) => {
    setActiveReceiptToPrint({
      title: 'Operational Expense Voucher',
      refNumber: 'EXP-' + expense.id.slice(-6).toUpperCase(),
      date: expense.date,
      party: 'Disbursement: ' + expense.description,
      total: expense.amount,
      mode: 'Cash / Ledger Outflow',
    });
  };

  return (
    <div className="flex flex-col w-full gap-y-space-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-space-sm bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-space-sm self-start sm:self-auto">
          <button
            className="inline-flex items-center gap-space-xs bg-primary text-on-primary hover:bg-primary-container px-space-md py-2 rounded-lg font-label-md text-label-md shadow-sm transition-all focus:outline-none"
            onClick={openAddModal}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add expense</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-space-sm rounded-xl shadow-sm border border-outline-variant/20">
        <div className="flex flex-1 items-center gap-space-sm">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              className="w-full bg-surface-container-low text-on-surface placeholder:text-outline pl-9 pr-space-md py-1.5 rounded-lg font-body-md text-body-md focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary transition-colors border border-outline-variant/20"
              placeholder="Search expense description..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-outline-variant/20">
            <button
              className={`font-label-sm text-label-sm px-space-sm py-1 rounded transition-colors ${
                activePeriod === 'month'
                  ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => { setActivePeriod('month'); const d=new Date(); setFromDate(localIso(new Date(d.getFullYear(),d.getMonth(),1))); setToDate(localIso(d)); }}
              type="button"
            >
              This Month
            </button>
            <button
              className={`font-label-sm text-label-sm px-space-sm py-1 rounded transition-colors ${
                activePeriod === 'custom'
                  ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => setActivePeriod('custom')}
              type="button"
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Active Filter Meta Display */}
        <div className="flex items-center gap-space-xs text-on-surface-variant font-data-mono-sm text-data-mono-sm pl-space-xs">
          <span className="material-symbols-outlined text-[16px] text-tertiary">date_range</span>
          {activePeriod === 'custom' ? <><input aria-label="Expense from date" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="h-8 px-1 rounded border border-outline-variant/30 bg-surface-container-lowest"/><span>to</span><input aria-label="Expense to date" type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="h-8 px-1 rounded border border-outline-variant/30 bg-surface-container-lowest"/></> : <span>{fromDate} — {toDate}</span>}
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/20">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-2.5 px-space-md w-[140px]" scope="col">
                  Date
                </th>
                <th className="py-2.5 px-space-md min-w-[280px]" scope="col">
                  Expense Description
                </th>
                <th className="py-2.5 px-space-md text-right w-[150px]" scope="col">
                  Amount (₹)
                </th>
                <th className="py-2.5 px-space-md text-right w-[140px]" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {filteredExpenses.map((exp, idx) => {
                const isUtility = exp.category?.toLowerCase() === 'utilities';
                return (
                  <tr
                    key={exp.id}
                    className={`hover:bg-surface-container-low transition-colors group ${
                      idx % 2 === 1 ? 'bg-surface/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-space-md font-data-mono-md text-data-mono-md text-on-surface-variant whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-2.5 px-space-md font-medium text-on-surface">
                      <div className="flex items-center gap-space-xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isUtility ? 'bg-secondary' : 'bg-outline-variant'
                          }`}
                        ></span>
                        <span className="flex flex-col"><span>{exp.description}</span><span className="text-[11px] font-normal text-on-surface-variant">{[exp.category, exp.paymentMethod, exp.notes].filter(Boolean).join(' · ')}</span></span>
                      </div>
                    </td>
                    <td className="py-2.5 px-space-md text-right font-data-mono-md text-data-mono-md text-on-surface whitespace-nowrap">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
                          title="View Receipt"
                          type="button"
                          onClick={() => handleViewReceipt(exp)}
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                        </button>
                        <button
                          className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                          title="Edit Expense"
                          type="button"
                          onClick={() => openEditModal(exp)}
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          className="p-1 rounded text-outline hover:text-error hover:bg-error-container/40 transition-colors"
                          title="Delete Expense"
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete expense "${exp.description}"?`)) {
                              deleteExpense(exp.id);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-on-surface-variant font-body-sm">
                    No matching expense entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Container */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-space-md py-space-sm bg-surface-container-low gap-space-sm border-t border-outline-variant/20">
          <div className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
            Showing <span className="font-semibold text-on-surface">1-{filteredExpenses.length}</span> of{' '}
            <span className="font-semibold text-on-surface">{expenses.length}</span> expenses • Total:{' '}
            <strong className="text-on-surface">{formatCurrency(totalExpenseAmount)}</strong>
          </div>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-space-md bg-inverse-surface/40"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[22px]">add_circle</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                  {modalMode === 'add' ? 'Add New Expense' : 'Edit Expense Details'}
                </h2>
              </div>
              <button
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-space-lg flex flex-col gap-space-md">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Date <span className="text-error">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="w-full h-9 px-space-sm bg-surface text-on-surface font-data-mono-md text-data-mono-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-outline-variant/30"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Expense Description <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Bill for October, Shop Cleaning Supplies"
                  className="w-full h-9 px-space-sm bg-surface text-on-surface placeholder:text-outline font-body-md text-body-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-outline-variant/30"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Amount (₹) <span className="text-error">*</span>
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
                    placeholder="0.00"
                    className="w-full h-9 pl-7 pr-space-sm bg-surface text-on-surface placeholder:text-outline font-data-mono-md text-data-mono-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary border border-outline-variant/30"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Category<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)} className="h-9 px-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface">{['General','Rent','Utilities','Transport','Maintenance','Supplies','Other'].map(value=><option key={value}>{value}</option>)}</select></label>
                <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Payment method<select value={expenseMethod} onChange={e=>setExpenseMethod(e.target.value)} className="h-9 px-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface">{['Cash','UPI','Bank transfer','Card','Other'].map(value=><option key={value}>{value}</option>)}</select></label>
              </div>
              <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Notes (optional)<textarea value={expenseNotes} onChange={e=>setExpenseNotes(e.target.value)} rows={2} className="px-2 py-1 rounded-lg border border-outline-variant/30 bg-surface-container-lowest text-on-surface" /></label>

              <div className="flex items-center justify-end gap-space-sm pt-space-md border-t border-outline-variant/20">
                <button
                  type="button"
                  className="px-space-md py-2 rounded-lg font-label-md text-label-md text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-lg py-2 rounded-lg font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-container shadow-sm transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
