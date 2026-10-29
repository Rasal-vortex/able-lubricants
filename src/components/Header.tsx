import React from 'react';
import { useApp } from '../context/AppContext';

const SCREEN_LABELS: Record<string, string> = {
  dashboard: 'Overview',
  'product-entry': 'Products',
  'sales-bill-entry': 'Sales',
  'credit-bill-management': 'Credit bills',
  'daily-sales-management': 'Daily sales',
  'expense-management': 'Expenses',
  'purchase-bill-entry': 'Purchases',
  'party-ledger-management': 'Party ledger',
  'reports-and-profit-calculation': 'Reports',
};

export const Header: React.FC = () => {
  const { activeScreen, setSearchModalOpen, authSession, logout } = useApp();
  return (
    <header className="fixed top-0 left-[232px] right-0 h-[56px] bg-white border-b border-outline-variant z-40 px-6 flex items-center justify-between">
      <div className="flex items-center text-[12px]">
        <span className="text-on-surface font-medium">{SCREEN_LABELS[activeScreen] || 'Overview'}</span>
      </div>
      <div className="flex items-center gap-3">
      <button type="button" onClick={() => setSearchModalOpen(true)} className="hidden sm:flex h-8 w-[260px] items-center gap-2 px-2.5 rounded-md border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low text-left">
        <span className="material-symbols-outlined text-[17px]">search</span>
        <span className="text-[12px] flex-1">Search records</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded border border-outline-variant bg-surface-container-low">Ctrl K</kbd>
      </button>
      {authSession && <div className="hidden md:flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="max-w-36 truncate">{authSession.user.name}</span>
        <span className="rounded-full bg-surface-container px-2 py-1 font-semibold text-primary">{authSession.user.role}</span>
        <button type="button" onClick={logout} className="rounded-md px-2 py-1 hover:bg-surface-container-low hover:text-on-surface">Sign out</button>
      </div>}
      </div>
      <button type="button" aria-label="Search records" onClick={() => setSearchModalOpen(true)} className="sm:hidden p-2 rounded-md text-on-surface-variant hover:bg-surface-container-low">
        <span className="material-symbols-outlined text-[19px]">search</span>
      </button>
    </header>
  );
};
