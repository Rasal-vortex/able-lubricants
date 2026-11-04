import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';

const SCREEN_LABELS: Record<string, string> = {
  dashboard: 'Overview',
  'product-entry': 'Products',
  'sales-bill-entry': 'Billing',
  'credit-bill-management': 'Credit bills',
  coupons: 'Coupons',
  'daily-sales-management': 'Daily sales',
  'expense-management': 'Expenses',
  'purchase-bill-entry': 'Purchases',
  'party-ledger-management': 'Party ledger',
  'reports-and-profit-calculation': 'Reports',
};

export const Header: React.FC = () => {
  const { activeScreen, authSession, logout, products, setActiveScreen } = useApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const lowStockProducts = products.filter((product) => product.status === 'Active' && product.quantity <= (product.minThreshold ?? 0));

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <header className="fixed left-[190px] right-0 top-0 z-40 flex h-[55px] items-center justify-between border-b border-white/10 bg-[#30343a] px-4 text-white sm:px-5">
      <div className="flex min-w-[100px] items-center text-[19px] font-extrabold tracking-tight sm:min-w-[180px]">
        <span>{SCREEN_LABELS[activeScreen] || 'Overview'}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
      <div className="relative" ref={notificationRef}>
        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-label={`Notifications${lowStockProducts.length ? `, ${lowStockProducts.length} low-stock products` : ''}`}
          aria-expanded={notificationsOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/90 transition hover:bg-white/10"
        >
          <Bell size={18} aria-hidden="true" />
          {lowStockProducts.length > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f5b600] px-1 text-[10px] font-bold leading-none text-[#17140c]">{lowStockProducts.length > 9 ? '9+' : lowStockProducts.length}</span>}
        </button>
        {notificationsOpen && <section className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#e9e3d9] bg-white text-[#171717] shadow-[0_12px_36px_rgba(20,18,14,.18)]" aria-label="Notifications">
          <div className="border-b border-[#eee8df] px-4 py-3">
            <h2 className="text-sm font-bold">Notifications</h2>
            <p className="mt-0.5 text-xs text-[#77736d]">Stock alerts for your store</p>
          </div>
          {lowStockProducts.length > 0 ? <>
            <div className="flex items-start gap-3 bg-[#fffaf0] px-4 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffe4a0] text-[#6f4b00]"><Package size={17} /></span>
              <div>
                <p className="text-sm font-semibold">Inventory needs attention</p>
                <p className="mt-0.5 text-xs text-[#77736d]">{lowStockProducts.length} active product{lowStockProducts.length === 1 ? '' : 's'} at or below the stock threshold.</p>
              </div>
            </div>
            <ul className="max-h-48 divide-y divide-[#f0ece5] overflow-y-auto px-4">
              {lowStockProducts.slice(0, 5).map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="min-w-0 truncate font-medium">{product.name}</span>
                <span className="shrink-0 text-[#77736d]">{product.quantity} {product.unit || 'in stock'}</span>
              </li>)}
            </ul>
            <button type="button" onClick={() => { setActiveScreen('product-entry'); setNotificationsOpen(false); }} className="flex w-full items-center justify-between border-t border-[#eee8df] px-4 py-3 text-sm font-semibold text-[#a86600] hover:bg-[#fffaf0]">
              View inventory <ArrowRight size={16} />
            </button>
          </> : <p className="px-4 py-5 text-sm text-[#77736d]">No stock warnings right now.</p>}
        </section>}
      </div>
      {authSession && <div className="flex items-center gap-2 text-xs sm:gap-3">
        <span className="rounded-full bg-[#f5b600] px-3 py-2 text-[10px] font-extrabold text-[#17140c]">{authSession.user.role}</span>
        <button type="button" onClick={logout} className="rounded-lg px-2 py-2 font-semibold text-white hover:bg-white/10 sm:px-3">Sign out</button>
      </div>}
      </div>
    </header>
  );
};
