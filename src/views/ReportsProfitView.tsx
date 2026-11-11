import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { getProfitReport } from '../services/api';
import LoaderOne from '../components/ui/loader-one';
import CountUp from '../components/ReactBitsCountUp';
import { Package, ShoppingCart, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';

const localDate = (d: Date) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };

export const ReportsProfitView: React.FC = () => {
  const { sales, expenses, purchases, products, creditBills, showToast, authSession } = useApp();
  const today = localDate(new Date());
  const [report, setReport] = useState<'daily' | 'sales' | 'purchases' | 'stock' | 'profit' | 'outstanding'>('daily');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [apiProfit, setApiProfit] = useState<any>(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const normalizeDate = (value?: string) => {
    if (!value) return '';
    const direct = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : localDate(parsed);
  };
  const inRange = (value?: string) => { const date = normalizeDate(value); return Boolean(date) && (!from || date >= from) && (!to || date <= to); };
  const rangedSales = sales.filter(s => inRange(s.date || s.dateTime));
  const rangedPurchases = purchases.filter(p => inRange(p.invoiceDate));
  const rangedExpenses = expenses.filter(e => inRange(e.date));
  const totalSales = rangedSales.reduce((n, s) => n + s.amount, 0);
  const totalExpenses = rangedExpenses.reduce((n, e) => n + e.amount, 0);
  const totalCogs = rangedSales.reduce((n, s) => n + (s.costOfGoodsSold ?? s.lineItems?.reduce((a, i) => a + i.quantity * i.purchaseRate, 0) ?? 0), 0);
  useEffect(() => {
    if (report !== 'profit' || !authSession) { setApiProfit(null); return; }
    let cancelled = false;
    setProfitLoading(true);
    void getProfitReport(authSession.token, `${from}T00:00:00`, `${to}T23:59:59`).then((result) => {
      if (!cancelled) setApiProfit(result);
    }).catch((error) => {
      if (!cancelled) { setApiProfit(null); showToast(error instanceof Error ? error.message : 'Profit report could not be loaded.', 'error'); }
    }).finally(() => { if (!cancelled) setProfitLoading(false); });
    return () => { cancelled = true; };
  }, [report, authSession, from, to, showToast]);
  const profitTotals = apiProfit?.totals;
  const reportRows = useMemo<Array<Array<string | number>>>(() => {
    if (report === 'sales') return rangedSales.map(s => [s.date || s.dateTime.slice(0,10), s.billNumber, s.customerName, s.paymentMode, formatCurrency(s.amount)]);
    if (report === 'purchases') return rangedPurchases.map(p => [p.invoiceDate, p.invoiceNumber, p.partyName, p.items.map(i => `${i.name} × ${i.quantity}`).join('; '), formatCurrency(p.totalAmount), formatCurrency(p.outstandingBalance || 0)]);
    if (report === 'stock') return products.map(p => [p.sku, p.name, p.unit, String(p.quantity), p.quantity <= (p.minThreshold ?? 0) ? 'Low stock' : 'In stock']);
    if (report === 'outstanding') return [
      ...creditBills.filter(b => b.netDue > 0 && inRange(b.billDate)).map(b => ['Customer', b.partyName, b.billNumber, b.dueDate, formatCurrency(b.netDue), b.status]),
      ...purchases.filter(p => (p.outstandingBalance || 0) > 0 && inRange(p.invoiceDate)).map(p => ['Supplier', p.partyName, p.invoiceNumber, p.invoiceDate, formatCurrency(p.outstandingBalance || 0), 'Payable']),
    ];
    if (report === 'profit' && apiProfit) {
      const newestFirst = [...(apiProfit.invoices || [])].sort((a: any, b: any) => {
        const dateDifference = new Date(b.date).getTime() - new Date(a.date).getTime();
        return dateDifference || String(b.invoiceNumber || '').localeCompare(String(a.invoiceNumber || ''));
      });
      return newestFirst.flatMap((invoice: any) => (invoice.items || []).map((item: any) => [normalizeDate(invoice.date), item.productName, item.quantity, formatCurrency(Number(item.saleAmount)), formatCurrency(Number(item.purchaseRate)), formatCurrency(Number(item.profit))]));
    }
    if (report === 'profit') return [];
    const dates = Array.from(new Set([...rangedSales.map(s => (s.date || s.dateTime).slice(0,10)), ...rangedExpenses.map(e => e.date.slice(0,10))])).sort((a,b) => b.localeCompare(a));
    return dates.map(date => {
      const daySales = rangedSales.filter(s => (s.date || s.dateTime).slice(0,10) === date).reduce((n,s) => n+s.amount,0);
      const dayExpense = rangedExpenses.filter(e => e.date.slice(0,10) === date).reduce((n,e) => n+e.amount,0);
      return [date, formatCurrency(daySales), formatCurrency(dayExpense), formatCurrency(daySales-dayExpense)];
    });
  }, [report, rangedSales, rangedPurchases, rangedExpenses, products, creditBills, totalSales, totalExpenses, totalCogs, apiProfit]);
  const columns = report === 'sales' ? ['Date', 'Bill', 'Customer', 'Payment', 'Total (INR)'] : report === 'purchases' ? ['Date', 'Supplier invoice', 'Supplier', 'Items', 'Total (INR)', 'Balance (INR)'] : report === 'stock' ? ['SKU', 'Product', 'Unit', 'On hand', 'Status'] : report === 'outstanding' ? ['Party type', 'Party', 'Reference', 'Due date', 'Outstanding (INR)', 'Status'] : report === 'profit' ? ['Date', 'Product', 'Quantity', 'Sale (INR)', 'Purchase rate (INR)', 'Profit (INR)'] : ['Date', 'Sales (INR)', 'Expenses (INR)', 'Net (INR)'];
  const exportCsv = () => {
    const csv = [columns, ...reportRows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `able-lubes-${report}-${today}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast('Report exported.');
  };

  return (
    <div className="daily-register-page w-full">
      <div className="daily-register-screen flex w-full flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-2xl border border-[#e9e3d9] bg-white p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)] sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[190px] flex-1 flex-col gap-1.5 text-xs font-semibold text-[#77736d]">Report
            <select value={report} onChange={e => setReport(e.target.value as typeof report)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-normal text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white">
              <option value="daily">Daily summary</option><option value="sales">Sales</option><option value="purchases">Purchases</option><option value="stock">Stock</option><option value="profit">Profit &amp; loss</option><option value="outstanding">Customer outstanding</option>
            </select>
          </label>
          <label className="flex min-w-[155px] flex-1 flex-col gap-1.5 text-xs font-semibold text-[#77736d]">From
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10 rounded-lg border border-[#ead8ad] bg-[#fff7e7] px-3 text-sm font-normal text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white" />
          </label>
          <label className="flex min-w-[155px] flex-1 flex-col gap-1.5 text-xs font-semibold text-[#77736d]">To
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10 rounded-lg border border-[#ead8ad] bg-[#fff7e7] px-3 text-sm font-normal text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white" />
          </label>
          <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d59a12] sm:ml-auto">Export CSV</button>
        </section>

        {(report === 'daily' || report === 'profit') && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([
              ['Net sales', totalSales, ShoppingCart],
              ['Purchases', rangedPurchases.reduce((n, p) => n + p.totalAmount, 0), Package],
              ['Expenses', totalExpenses, Wallet],
              ['Net profit', report === 'profit' && profitTotals ? Number(profitTotals.totalProfit) - totalExpenses : totalSales - totalCogs - totalExpenses, TrendingUp],
            ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon], index) => (
              <div key={label} className="relative isolate overflow-hidden rounded-2xl border border-[#e7e4de] bg-gradient-to-br from-white via-[#fbfaf8] to-[#f1efeb] p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)]">
                <Icon aria-hidden="true" size={76} strokeWidth={1.5} className="pointer-events-none absolute -bottom-3 -right-2 -z-10 text-[#77736d] opacity-[0.09]" />
                <div className="relative text-sm font-medium text-[#77736d]">{label}</div>
                <div className="relative mt-2 text-2xl font-bold tracking-tight text-[#262522]">
                  <CountUp
                    to={Number(value)}
                    duration={0.8}
                    delay={index * 0.08}
                    trigger="view"
                    easing="easeOut"
                    formatter={(amount) => formatCurrency(Number.isInteger(value) ? Math.round(amount) : Number(amount.toFixed(2)))}
                  />
                </div>
              </div>
            ))}
          </section>
        )}



        <section className="overflow-hidden rounded-2xl border border-[#e9e3d9] bg-white shadow-[0_3px_12px_rgba(37,27,12,.06)]">
          <div className="flex items-center justify-between border-b border-[#eee8df] px-4 py-3">
            <h2 className="text-sm font-bold text-[#272727]">{report === 'daily' ? 'Daily summary' : report === 'profit' ? 'Product profit details' : `${columns[0]} report`}</h2>
            <span className="text-xs text-[#77736d]">{reportRows.length} {reportRows.length === 1 ? 'record' : 'records'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead><tr className="h-11 bg-[#f6f5f2] text-xs font-bold uppercase tracking-wide text-[#6d685f]">{columns.map(col => <th key={col} className="whitespace-nowrap px-4 py-3">{col}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                {profitLoading ? (
                  <tr><td colSpan={columns.length} className="px-4 py-14 text-center"><LoaderOne /></td></tr>
                ) : reportRows.length ? (
                  reportRows.map((row, i) => <tr key={i} className="transition hover:bg-[#fffdf8]">{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)
                ) : (
                  <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-[#77736d]">No records in this date range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
