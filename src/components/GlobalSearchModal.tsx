import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

export const GlobalSearchModal: React.FC = () => {
  const {
    searchModalOpen,
    setSearchModalOpen,
    products,
    sales,
    creditBills,
    expenses,
    setActiveScreen,
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchModalOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchModalOpen]);

  if (!searchModalOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)).slice(0, 4)
    : [];

  const matchedSales = q
    ? sales.filter((s) => s.billNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const matchedCredits = q
    ? creditBills.filter((c) => c.billNumber.toLowerCase().includes(q) || c.partyName.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const matchedExpenses = q
    ? expenses.filter((e) => e.description.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const hasResults =
    matchedProducts.length > 0 ||
    matchedSales.length > 0 ||
    matchedCredits.length > 0 ||
    matchedExpenses.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0b1c30]/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
      onClick={() => setSearchModalOpen(false)}
    >
      <div
        className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/30 w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-outline-variant/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">search</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-on-surface font-body-md text-body-md focus:outline-none placeholder:text-outline"
            placeholder="Search products, invoices, customers, expenses, or SKUs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchModalOpen(false);
            }}
          />
          <kbd className="font-data-mono-sm text-[11px] bg-surface-container-low px-1.5 py-0.5 rounded text-outline border border-outline-variant/30">
            Esc
          </kbd>
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-outline-variant/10">
          {!q ? (
            <div className="p-6 text-center text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[32px] text-outline mb-1">manage_search</span>
              <p>Type to search across the entire LedgerBill ERP database</p>
              <div className="flex items-center justify-center gap-2 mt-2 font-data-mono-sm text-[11px] text-outline">
                <span className="bg-surface-container-low px-2 py-0.5 rounded">Products</span>
                <span className="bg-surface-container-low px-2 py-0.5 rounded">Sales Bills</span>
                <span className="bg-surface-container-low px-2 py-0.5 rounded">Credit Invoices</span>
                <span className="bg-surface-container-low px-2 py-0.5 rounded">Expenses</span>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="p-6 text-center text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[32px] text-outline mb-1">search_off</span>
              <p>No matching records found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-3 p-1">
              {/* Products */}
              {matchedProducts.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Products ({matchedProducts.length})
                  </div>
                  {matchedProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActiveScreen('product-entry');
                        setSearchModalOpen(false);
                      }}
                      className="p-2 rounded hover:bg-surface-container-low cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md font-medium text-on-surface">{p.name}</span>
                        <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                          {p.sku} • {p.brand} • In Stock: {p.quantity} units
                        </span>
                      </div>
                      <span className="font-data-mono-md text-data-mono-md font-bold text-primary">
                        {formatCurrency(p.sellingPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sales */}
              {matchedSales.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Sales Bills ({matchedSales.length})
                  </div>
                  {matchedSales.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveScreen('daily-sales-management');
                        setSearchModalOpen(false);
                      }}
                      className="p-2 rounded hover:bg-surface-container-low cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-data-mono-md text-data-mono-md font-semibold text-primary">{s.billNumber}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {s.customerName} • {s.paymentMode} • {s.dateTime}
                        </span>
                      </div>
                      <span className="font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                        {formatCurrency(s.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Credit Bills */}
              {matchedCredits.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Credit Receivables ({matchedCredits.length})
                  </div>
                  {matchedCredits.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveScreen('credit-bill-management');
                        setSearchModalOpen(false);
                      }}
                      className="p-2 rounded hover:bg-surface-container-low cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-data-mono-md text-data-mono-md font-semibold text-primary">{c.billNumber}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {c.partyName} • {c.status}
                        </span>
                      </div>
                      <span className="font-data-mono-md text-data-mono-md font-bold text-error">
                        {formatCurrency(c.netDue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Expenses */}
              {matchedExpenses.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Expenses ({matchedExpenses.length})
                  </div>
                  {matchedExpenses.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => {
                        setActiveScreen('expense-management');
                        setSearchModalOpen(false);
                      }}
                      className="p-2 rounded hover:bg-surface-container-low cursor-pointer flex items-center justify-between"
                    >
                      <span className="font-body-md text-body-md text-on-surface">{e.description}</span>
                      <span className="font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                        {formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
          <span>Press Enter to select • Esc to dismiss</span>
          <span>Ledger Index v2.4</span>
        </div>
      </div>
    </div>
  );
};
