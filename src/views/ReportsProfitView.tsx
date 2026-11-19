import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { getExpenseReport, getProfitReport, getSalesReport } from '../services/api';
import LoaderOne from '../components/ui/loader-one';
import CountUp from '../components/ReactBitsCountUp';
import { Package, ShoppingCart, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';

const localDate = (d: Date) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };

export const ReportsProfitView: React.FC = () => {
  const { expenses, purchases, products, creditBills, showToast, authSession } = useApp();
  const today = localDate(new Date());
  const [report, setReport] = useState<'daily' | 'sales' | 'purchases' | 'stock' | 'profit' | 'outstanding'>('daily');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [apiProfit, setApiProfit] = useState<any>(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [apiSalesReport, setApiSalesReport] = useState<any>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [apiExpenseReport, setApiExpenseReport] = useState<any>(null);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const normalizeDate = (value?: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : localDate(parsed);
  };
  const inRange = (value?: string) => { const date = normalizeDate(value); return Boolean(date) && (!from || date >= from) && (!to || date <= to); };
  const rangedPurchases = purchases.filter(p => inRange(p.invoiceDate));
  const rangedExpenses = expenses.filter(e => inRange(e.date));
  const totalSales = apiSalesReport ? Number(apiSalesReport.totals?.sales || 0) : 0;
  const totalExpenses = rangedExpenses.reduce((n, e) => n + e.amount, 0);
  useEffect(() => {
    if ((report !== 'profit' && report !== 'daily') || !authSession) { setApiProfit(null); return; }
    let cancelled = false;
    setApiProfit(null);
    setProfitLoading(true);
    void getProfitReport(authSession.token, `${from}T00:00:00`, `${to}T23:59:59`).then((result) => {
      if (!cancelled) setApiProfit(result);
    }).catch((error) => {
      if (!cancelled) { setApiProfit(null); showToast(error instanceof Error ? error.message : 'Profit report could not be loaded.', 'error'); }
    }).finally(() => { if (!cancelled) setProfitLoading(false); });
    return () => { cancelled = true; };
  }, [report, authSession, from, to, showToast]);
  useEffect(() => {
    if ((report !== 'daily' && report !== 'sales') || !authSession) { setApiSalesReport(null); return; }
    let cancelled = false;
    setApiSalesReport(null);
    setSalesLoading(true);
    void getSalesReport(authSession.token, `${from}T00:00:00`, `${to}T23:59:59`).then((result) => {
      if (!cancelled) setApiSalesReport(result);
    }).catch((error) => {
      if (!cancelled) { setApiSalesReport(null); showToast(error instanceof Error ? error.message : 'Sales report could not be loaded.', 'error'); }
    }).finally(() => { if (!cancelled) setSalesLoading(false); });
    return () => { cancelled = true; };
  }, [report, authSession, from, to, showToast]);
  useEffect(() => {
    if (report !== 'daily' || !authSession) { setApiExpenseReport(null); return; }
    let cancelled = false;
    setApiExpenseReport(null);
    setExpenseLoading(true);
    void getExpenseReport(authSession.token, `${from}T00:00:00`, `${to}T23:59:59`).then((result) => {
      if (!cancelled) setApiExpenseReport(result);
    }).catch((error) => {
      if (!cancelled) { setApiExpenseReport(null); showToast(error instanceof Error ? error.message : 'Expense report could not be loaded.', 'error'); }
    }).finally(() => { if (!cancelled) setExpenseLoading(false); });
    return () => { cancelled = true; };
  }, [report, authSession, from, to, showToast]);
  const salesInvoices = apiSalesReport?.invoices as any[] | undefined;
  const apiTotalSales = Number(apiSalesReport?.totals?.sales ?? 0);
  const profitTotals = apiProfit?.totals;
  const displayedNetSales = report === 'profit' && profitTotals
    ? Number(profitTotals.netSales ?? (apiProfit.invoices || []).reduce((total: number, invoice: any) => total + (invoice.items || []).reduce((invoiceTotal: number, item: any) => invoiceTotal + Number(item.saleAmount || 0), 0), 0))
    : (report === 'daily' || report === 'sales') ? apiTotalSales : totalSales;
  const displayedExpenses = report === 'daily' && apiExpenseReport
    ? Number(apiExpenseReport.total)
    : report === 'profit' && profitTotals
      ? Number(profitTotals.totalExpenses)
      : totalExpenses;
  const displayedNetProfit = (report === 'profit' || report === 'daily') && profitTotals
    ? Number(profitTotals.finalProfit)
    : totalSales - totalExpenses;
  const reportRows = useMemo<Array<Array<string | number>>>(() => {
    if (report === 'sales') return (salesInvoices || []).map((s) => [normalizeDate(s.date), s.invoiceNumber, s.customer, (s.payments || []).map((payment: any) => payment.method).join(' + ') || 'Credit', formatCurrency(Number(s.total))]);
    if (report === 'purchases') return rangedPurchases.map(p => [p.invoiceDate, p.invoiceNumber, p.partyName, p.items.map(i => `${i.name} × ${i.quantity}`).join('; '), formatCurrency(p.totalAmount), formatCurrency(p.outstandingBalance || 0)]);
    if (report === 'stock') return products.flatMap(p => {
      const batchRows = p.batches.map(batch => [
        p.sku,
        p.name,
        batch.label || `${batch.source} · ${normalizeDate(batch.receivedAt)} · ${batch.id.slice(0, 8)}`,
        p.unit,
        String(batch.remainingQuantity),
        formatCurrency(batch.sellingRate),
        p.quantity <= (p.minThreshold ?? 0) ? 'Low stock' : 'In stock',
      ]);
      const batchQuantity = p.batches.reduce((total, batch) => total + batch.remainingQuantity, 0);
      const unassigned = p.quantity - batchQuantity;
      if (Math.abs(unassigned) > 0.0005) {
        batchRows.push([
          p.sku,
          p.name,
          unassigned > 0 ? 'Unassigned legacy stock' : 'Batch total exceeds aggregate',
          p.unit,
          String(unassigned),
          '—',
          'Needs stock reconciliation',
        ]);
      } else if (batchRows.length === 0) {
        batchRows.push([p.sku, p.name, 'No available batch', p.unit, '0', '—', 'Out of stock']);
      }
      return batchRows;
    });
    if (report === 'outstanding') return [
      ...creditBills.filter(b => b.netDue > 0 && inRange(b.billDate)).map(b => ['Customer', b.partyName, b.billNumber, b.dueDate, formatCurrency(b.netDue), b.status]),
      ...purchases.filter(p => (p.outstandingBalance || 0) > 0 && inRange(p.invoiceDate)).map(p => ['Supplier', p.partyName, p.invoiceNumber, p.invoiceDate, formatCurrency(p.outstandingBalance || 0), 'Payable']),
    ];
    if (report === 'profit' && apiProfit) {
      const newestFirst = [...(apiProfit.invoices || [])].sort((a: any, b: any) => {
        const dateDifference = new Date(b.date).getTime() - new Date(a.date).getTime();
        return dateDifference || String(b.invoiceNumber || '').localeCompare(String(a.invoiceNumber || ''));
      });
      return newestFirst.flatMap((invoice: any) => (invoice.items || []).map((item: any) => [normalizeDate(invoice.date), item.productName, item.quantity, formatCurrency(Number(item.saleAmount)), formatCurrency(Number(item.purchaseRate)), item.costBasis === 'VERIFIED_BATCH' ? 'Verified batch' : 'Legacy estimate', formatCurrency(Number(item.profit))]));
    }
    if (report === 'profit') return [];
    const reportSales = (apiSalesReport?.days || (salesInvoices || []).map((s: any) => ({ date: normalizeDate(s.date), sales: s.total })))
      .map((sale: any) => ({ date: normalizeDate(sale.date), amount: Number(sale.sales) || 0 }));
    const reportExpenses = (apiExpenseReport?.days || []).map((expense: any) => ({ date: expense.date, amount: Number(expense.total) || 0 }));
    const profitByDate = new Map<string, number>();
    for (const invoice of apiProfit?.invoices || []) {
      const date = normalizeDate(invoice.date);
      const invoiceProfit = (invoice.items || []).reduce((total: number, item: any) => total + Number(item.profit || 0), 0);
      profitByDate.set(date, (profitByDate.get(date) || 0) + invoiceProfit);
    }
    const dates = Array.from(new Set([
      ...reportSales.map((sale: { date: string }) => sale.date),
      ...reportExpenses.map((expense: { date: string }) => expense.date),
      ...profitByDate.keys(),
    ].filter(Boolean))).sort((a,b) => b.localeCompare(a));
    return dates.map(date => {
      const daySales = reportSales.filter((sale: { date: string }) => sale.date === date).reduce((n: number, sale: { amount: number }) => n + sale.amount, 0);
      const dayExpense = reportExpenses.filter((expense: { date: string }) => expense.date === date).reduce((n: number, expense: { amount: number }) => n + expense.amount, 0);
      const dayProfit = apiProfit ? (profitByDate.get(date) || 0) - dayExpense : null;
      return [date, formatCurrency(daySales), formatCurrency(dayExpense), dayProfit === null ? '—' : formatCurrency(dayProfit)];
    });
  }, [report, rangedPurchases, rangedExpenses, products, creditBills, totalSales, totalExpenses, apiProfit, apiSalesReport, apiExpenseReport, salesInvoices]);
  const columns = report === 'sales' ? ['Date', 'Bill', 'Customer', 'Payment', 'Total (INR)'] : report === 'purchases' ? ['Date', 'Supplier invoice', 'Supplier', 'Items', 'Total (INR)', 'Balance (INR)'] : report === 'stock' ? ['SKU', 'Product', 'Batch', 'Unit', 'Available', 'Selling rate (INR)', 'Status'] : report === 'outstanding' ? ['Party type', 'Party', 'Reference', 'Due date', 'Outstanding (INR)', 'Status'] : report === 'profit' ? ['Date', 'Product', 'Quantity', 'Sale (INR)', 'Purchase rate (INR)', 'Cost basis', 'Profit (INR)'] : ['Date', 'Sales (INR)', 'Expenses (INR)', 'Net (INR)'];
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
              ['Net sales', displayedNetSales, ShoppingCart],
              ['Purchases', rangedPurchases.reduce((n, p) => n + p.totalAmount, 0), Package],
              ['Expenses', displayedExpenses, Wallet],
              ['Net profit', displayedNetProfit, TrendingUp],
            ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon], index) => (
              <div key={label} className="relative isolate overflow-hidden rounded-2xl border border-[#e7e4de] bg-gradient-to-br from-white via-[#fbfaf8] to-[#f1efeb] p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)]">
                <Icon aria-hidden="true" size={76} strokeWidth={1.5} className="pointer-events-none absolute -bottom-3 -right-2 -z-10 text-[#77736d] opacity-[0.09]" />
                <div className="relative text-sm font-medium text-[#77736d]">{label}</div>
                <div className="relative mt-2 text-2xl font-bold tracking-tight text-[#262522]">
                  {report === 'daily' && label === 'Net profit' && !profitTotals
                    ? profitLoading ? <LoaderOne /> : '—'
                    : report === 'daily' && label === 'Expenses' && !apiExpenseReport
                      ? expenseLoading ? <LoaderOne /> : '—'
                      : <CountUp
                        to={Number(value)}
                        duration={0.8}
                        delay={index * 0.08}
                        trigger="view"
                        easing="easeOut"
                        formatter={(amount) => formatCurrency(Number.isInteger(value) ? Math.round(amount) : Number(amount.toFixed(2)))}
                      />}
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
                {(profitLoading || salesLoading || expenseLoading) ? (
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
