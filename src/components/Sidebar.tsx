import React from "react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { NavScreen } from "../types";

interface NavItem {
  id: NavScreen;
  label: string;
  icon: string;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "",
    items: [
      { id: "dashboard", label: "Overview", icon: "grid_view" },
      { id: "sales-bill-entry", label: "Billing", icon: "receipt_long" },
      {
        id: "daily-sales-management",
        label: "Daily sales",
        icon: "calendar_today",
      },
    ],
  },
  {
    title: "Records",
    items: [
      { id: "product-entry", label: "Products", icon: "inventory_2" },
      {
        id: "credit-bill-management",
        label: "Credit bills",
        icon: "credit_score",
      },
      { id: "coupons", label: "Coupons", icon: "confirmation_number" },
      { id: "purchase-bill-entry", label: "Purchases", icon: "local_shipping" },
      { id: "expense-management", label: "Expenses", icon: "account_balance_wallet" },
      {
        id: "party-ledger-management",
        label: "Party ledger",
        icon: "menu_book",
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        id: "reports-and-profit-calculation",
        label: "Reports",
        icon: "bar_chart",
      },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen } = useApp();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-[190px] select-none flex-col border-r border-[#e8e1d7] bg-[#fffdf9]">
      <button
        type="button"
        onClick={() => setActiveScreen("dashboard")}
        className="flex h-[80px] items-center gap-2.5 border-b border-[#eee8df] px-3 text-left"
      >
        <span className="flex h-[60px] w-[48px] shrink-0 flex-col items-center justify-center border-2 border-[#171717] bg-[#f4b600] text-[9px] font-black leading-[10px] text-[#111] shadow-[inset_0_0_0_2px_#f4b600]">
          ABLE<br />LUBES<span className="text-[7px]">SINCE 1986</span>
        </span>
        <span className="sidebar-brand-copy flex flex-col">
          <span className="text-[14px] font-extrabold tracking-tight text-[#171717]">
            Able Lubes
          </span>
          <span className="text-[12px] text-[#716b62]">
            Store workspace
          </span>
        </span>
      </button>

      <nav className="sidebar-nav-scroll relative z-10 flex-1 space-y-5 overflow-y-auto px-2.5 py-3 pb-32">
        {NAV_GROUPS.map((group) => (
          <section key={group.title}>
            {group.title && <h2 className="sidebar-section-title mb-2 px-3 text-[11px] font-bold uppercase tracking-[.07em] text-[#878178]">
              {group.title}
            </h2>}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeScreen === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    onClick={() => setActiveScreen(item.id)}
                    className={`relative isolate flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] transition-colors ${active ? "font-bold text-[#19150b]" : "text-[#252525] hover:bg-[#f5f0e8]"}`}
                  >
                    {active && <motion.span
                      layoutId="sidebar-active-highlight"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.7 }}
                      className="absolute inset-0 -z-10 rounded-xl bg-[#ffdf83] shadow-[0_2px_6px_rgba(159,111,0,.12)]"
                      aria-hidden="true"
                    />}
                    <span className={`material-symbols-outlined shrink-0 text-[21px] ${active ? 'text-[#17140d]' : 'text-[#272727]'}`}>
                      {item.icon}
                    </span>
                    <span className="sidebar-label truncate">{item.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <div className="sidebar-oil-art pointer-events-none absolute bottom-0 left-0 z-0 h-[160px] w-full overflow-hidden" aria-hidden="true">
        <img
          src="/assets/Glossy%20Golden%20Wave%20on%20Ivory-Photoroom.png"
          alt=""
          className="absolute -bottom-1 -left-2 h-auto w-[180px] max-w-none object-contain"
          style={{
            opacity: 0.7,
            maskImage: 'linear-gradient(to top, #000 24%, rgba(0,0,0,.55) 72%, transparent 100%)',
          }}
        />
      </div>
    </aside>
  );
};
