import React from 'react';
import { useApp } from '../context/AppContext';
import { NavScreen } from '../types';

interface NavItem { id: NavScreen; label: string; icon: string; }

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'Workspace', items: [
    { id: 'dashboard', label: 'Overview', icon: 'grid_view' },
    { id: 'sales-bill-entry', label: 'Sales', icon: 'receipt_long' },
    { id: 'daily-sales-management', label: 'Daily sales', icon: 'calendar_today' },
  ] },
  { title: 'Records', items: [
    { id: 'product-entry', label: 'Products', icon: 'inventory_2' },
    { id: 'credit-bill-management', label: 'Credit bills', icon: 'credit_score' },
    { id: 'purchase-bill-entry', label: 'Purchases', icon: 'local_shipping' },
    { id: 'party-ledger-management', label: 'Party ledger', icon: 'menu_book' },
  ] },
  { title: 'Insights', items: [
    { id: 'reports-and-profit-calculation', label: 'Reports', icon: 'bar_chart' },
  ] },
];

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen } = useApp();

  return (
    <aside className="fixed left-0 top-0 h-full w-[232px] bg-white border-r border-outline-variant z-50 flex flex-col select-none">
      <button type="button" onClick={() => setActiveScreen('dashboard')} className="h-[68px] px-5 flex items-center gap-3 border-b border-outline-variant text-left">
        <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center material-symbols-outlined text-[19px]">tire_repair</span>
        <span className="sidebar-brand-copy flex flex-col">
          <span className="text-[14px] font-semibold tracking-tight text-on-surface">Able Lubes</span>
          <span className="text-[11px] text-on-surface-variant">Store workspace</span>
        </span>
      </button>

      <nav className="flex-1 px-3 py-1 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group) => <section key={group.title}>
          <h2 className="sidebar-section-title px-2 mb-1.5 text-[10px] font-medium uppercase tracking-[.08em] text-on-surface-variant">{group.title}</h2>
          <div className="space-y-0.5">{group.items.map((item) => {
            const active = activeScreen === item.id;
            return <button key={item.id} type="button" aria-current={active ? 'page' : undefined} title={item.label} onClick={() => setActiveScreen(item.id)} className={`w-full h-9 rounded-md px-2.5 flex items-center gap-2.5 text-left text-[12px] transition-colors ${active ? 'bg-[#eef2ff] text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-[18px] shrink-0">{item.icon}</span><span className="sidebar-label truncate">{item.label}</span>
            </button>;
          })}</div>
        </section>)}
      </nav>
      <div className="px-4 py-3 border-t border-outline-variant text-[11px] text-on-surface-variant flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" /><span className="sidebar-label">Demo data</span>
      </div>
    </aside>
  );
};
