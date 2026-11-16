import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { getSalesReport } from '../services/api';

export const GlobalSearchModal: React.FC = () => {
  const {
    searchModalOpen,
    setSearchModalOpen,
    products,
    creditBills,
    setActiveScreen,
    authSession,
    showToast,
  } = useApp();

  const [query, setQuery] = useState('');
  const [searchableSales, setSearchableSales] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchModalOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
      if (authSession) {
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 365);
        const dateKey = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        void getSalesReport(authSession.token, `${dateKey(from)}T00:00:00`, `${dateKey(to)}T23:59:59`)
          .then((result) => setSearchableSales(result.invoices || []))
          .catch((error) => showToast(error instanceof Error ? error.message : 'Sales could not be searched.', 'error'));
      }
    }
  }, [searchModalOpen, authSession, showToast]);

  if (!searchModalOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)).slice(0, 4)
    : [];

  const matchedSales = q
    ? searchableSales.filter((s) => String(s.invoiceNumber || '').toLowerCase().includes(q) || String(s.customer || '').toLowerCase().includes(q)).slice(0, 3)
    : [];

  const matchedCredits = q
    ? creditBills.filter((c) => c.billNumber.toLowerCase().includes(q) || c.partyName.toLowerCase().includes(q)).slice(0, 3)
    : [];

  const hasResults =
    matchedProducts.length > 0 ||
    matchedSales.length > 0 ||
    matchedCredits.length > 0;

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
            placeholder="Search products, invoices, customers, or SKUs..."
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
                          {p.sku} • {p.brand} • In Stock: {p.quantity} {p.unit || 'units'}
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
                        <span className="font-data-mono-md text-data-mono-md font-semibold text-primary">{s.invoiceNumber}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {s.customer} • {new Date(s.date).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                        {formatCurrency(Number(s.total) || 0)}
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
