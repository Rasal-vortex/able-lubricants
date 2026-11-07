import React, { useEffect, useState } from 'react';
import { ArrowRight, ShoppingCart, Wallet, UsersRound, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { StatsWidget } from '../components/ui/stats-widget';
import { SalesRevenueAreaChart } from '../components/ui/sales-revenue-area-chart';
import CountUp from '../components/ReactBitsCountUp';
import { DashboardSummary, getDashboardSummary } from '../services/api';

const formatMoney = formatCurrency;

const DashboardPanel: React.FC<{ title: string; icon: React.ReactNode; action: string; onAction: () => void; children: React.ReactNode }> = ({ title, icon, action, onAction, children }) => (
  <section className="overflow-hidden rounded-2xl border border-[#eee8df] bg-white shadow-[0_3px_14px_rgba(37,27,12,.06)]">
    <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe4a0] text-[#251f12]">{icon}</span>
        <h2 className="truncate text-lg font-bold tracking-tight text-[#171717]">{title}</h2>
      </div>
      <button type="button" onClick={onAction} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#b87500] hover:text-[#815100]">
        <span className="hidden sm:inline">{action}</span><ArrowRight size={18} />
      </button>
    </div>
    {children}
  </section>
);

export const DashboardView: React.FC = () => {
  const { authSession, setActiveScreen } = useApp();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const greetingName = authSession?.user.role === 'ADMIN' ? 'Admin' : authSession?.user.name.split(' ')[0] || 'there';
  useEffect(() => {
    if (!authSession?.token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDashboardSummary(authSession.token, selectedMonth).then((data) => {
      if (!cancelled) setSummary(data);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Dashboard data could not be loaded.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [authSession?.token, selectedMonth]);

  const metrics = [
    { label: "Today's sales", value: Number(summary?.today.salesTotal || 0), icon: <ShoppingCart strokeWidth={1.6} /> },
    { label: "Today's expenses", value: Number(summary?.today.expensesTotal || 0), icon: <Wallet strokeWidth={1.6} /> },
    { label: 'Customer outstanding', value: Number(summary?.balances.customerOutstanding || 0), icon: <UsersRound strokeWidth={1.6} /> },
    { label: 'Supplier payable', value: Number(summary?.balances.supplierPayable || 0), icon: <Truck strokeWidth={1.6} /> },
  ];

  return (
    <div className="flex w-full flex-col gap-3">
      <section className="dashboard-top-grid grid grid-cols-1 gap-3" aria-label="Business overview">
        <div
          className="dashboard-welcome-card relative isolate flex min-h-[164px] overflow-hidden rounded-2xl bg-[#16191c] bg-cover px-5 py-4 text-white shadow-[0_5px_20px_rgba(15,13,9,.15)] sm:px-5"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(12,14,16,.12), rgba(12,14,16,0) 72%), url('/assets/Premium%20Golden%20Oil%20Wave%20Composition.png')",
            backgroundPosition: 'center 62%',
          }}
        >
          <div className="relative z-10 max-w-[68%] self-center">
            <h1 className="text-[24px] font-extrabold leading-tight tracking-tight">Welcome back,<br />{greetingName}!</h1>
            <p className="mt-2 max-w-[220px] text-[12px] leading-[17px] text-white/80">Here’s what’s happening in your store today.</p>
          </div>
        </div>

        {metrics.map((metric, index) => {
          return (
            <StatsWidget
              key={metric.label}
              label={metric.label}
              value={metric.value}
              formatter={formatMoney}
              icon={metric.icon}
              delay={index * 100}
            />
          );
        })}
      </section>

      <section className="dashboard-analytics-grid grid grid-cols-1 gap-3">
        <SalesRevenueAreaChart summary={summary} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />

        <section className="flex flex-col rounded-2xl border border-[#eee8df] bg-white p-5 shadow-[0_3px_14px_rgba(37,27,12,.06)] sm:p-6" aria-label="Monthly sales summary">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-[#171717]">Sales overview</h2>
              <p className="mt-1 text-xs text-[#77736d]">Current month</p>
            </div>
          </div>
          <div className="relative my-5 flex flex-1 flex-col items-center justify-center overflow-hidden rounded-xl bg-[#fffaf0] px-4 py-6 text-center">
            <ShoppingCart size={164} strokeWidth={1.2} className="pointer-events-none absolute -bottom-8 right-1 text-[#b87500] opacity-[.075]" aria-hidden="true" />
            <p className="relative z-10 text-4xl font-extrabold tracking-tight text-[#171717]"><CountUp to={summary?.currentMonth.salesCount || 0} decimals={0} duration={0.65} trigger="view" easing="easeOut" /></p>
            <p className="relative z-10 mt-1 text-sm text-[#69645b]">sales recorded</p>
          </div>
          <div className="border-t border-[#eee8df] pt-4">
            <p className="text-xs text-[#69645b]">Collected today</p>
            <p className="mt-1 text-xl font-bold text-[#171717]">{formatMoney(Number(summary?.today.paymentsCollected || 0))}</p>
          </div>
        </section>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <DashboardPanel title="Recent sales" icon={<ShoppingCart size={21} />} action="View sales" onAction={() => setActiveScreen('daily-sales-management')}>
          <div className="overflow-x-auto px-4 pb-4 sm:px-5">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-[#f6f3ee] text-[#605b52]"><tr><th className="rounded-l-lg px-3 py-2.5 font-semibold">Invoice</th><th className="px-3 py-2.5 font-semibold">Customer</th><th className="px-3 py-2.5 font-semibold">Payment</th><th className="rounded-r-lg px-3 py-2.5 text-right font-semibold">Total</th></tr></thead>
              <tbody className="divide-y divide-[#eee8df]">
                {summary?.latestSales.map((sale) => <tr key={sale.invoiceNumber} className="hover:bg-[#fffaf1]"><td className="px-3 py-3 font-semibold text-[#a86600] underline decoration-[#dfbd7b] underline-offset-2">{sale.invoiceNumber}</td><td className="px-3 py-3">{sale.customerName}</td><td className="px-3 py-3"><span className="rounded-full bg-[#fff0c7] px-3 py-1 text-xs font-semibold text-[#493819]">{sale.paymentMethod}</span></td><td className="px-3 py-3 text-right font-bold">{formatMoney(Number(sale.total))}</td></tr>)}
                {!loading && (!summary?.latestSales.length) && <tr><td colSpan={4} className="px-3 py-9 text-center text-[#77736d]">No sales recorded yet.</td></tr>}
                {loading && <tr><td colSpan={4} className="px-3 py-9 text-center text-[#77736d]">Loading sales…</td></tr>}
                {error && <tr><td colSpan={4} className="px-3 py-3 text-center text-red-700">{error}</td></tr>}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

      </section>

    </div>
  );
};
