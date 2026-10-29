import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

const localDate = (d: Date) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };

export const ReportsProfitView: React.FC = () => {
  const { sales, expenses, purchases, products, creditBills, showToast } = useApp();
  const today = localDate(new Date());
  const [report, setReport] = useState<'daily' | 'sales' | 'purchases' | 'stock' | 'profit' | 'outstanding'>('daily');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
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
  const reportRows = useMemo(() => {
    if (report === 'sales') return rangedSales.map(s => [s.date || s.dateTime.slice(0,10), s.billNumber, s.customerName, s.paymentMode, formatCurrency(s.amount)]);
    if (report === 'purchases') return rangedPurchases.map(p => [p.invoiceDate, p.invoiceNumber, p.partyName, p.items.map(i => `${i.name} × ${i.quantity}`).join('; '), formatCurrency(p.totalAmount), formatCurrency(p.outstandingBalance || 0)]);
    if (report === 'stock') return products.map(p => [p.sku, p.name, p.unit, String(p.quantity), p.quantity <= (p.minThreshold ?? 0) ? 'Low stock' : 'In stock']);
    if (report === 'outstanding') return [
      ...creditBills.filter(b => b.netDue > 0 && inRange(b.billDate)).map(b => ['Customer', b.partyName, b.billNumber, b.dueDate, formatCurrency(b.netDue), b.status]),
      ...purchases.filter(p => (p.outstandingBalance || 0) > 0 && inRange(p.invoiceDate)).map(p => ['Supplier', p.partyName, p.invoiceNumber, p.invoiceDate, formatCurrency(p.outstandingBalance || 0), 'Payable']),
    ];
    if (report === 'profit') return [['Selected period', formatCurrency(totalSales), formatCurrency(totalCogs), formatCurrency(totalExpenses), formatCurrency(totalSales - totalCogs - totalExpenses)]];
    const dates = Array.from(new Set([...rangedSales.map(s => (s.date || s.dateTime).slice(0,10)), ...rangedExpenses.map(e => e.date.slice(0,10))])).sort((a,b) => b.localeCompare(a));
    return dates.map(date => {
      const daySales = rangedSales.filter(s => (s.date || s.dateTime).slice(0,10) === date).reduce((n,s) => n+s.amount,0);
      const dayExpense = rangedExpenses.filter(e => e.date.slice(0,10) === date).reduce((n,e) => n+e.amount,0);
      return [date, formatCurrency(daySales), formatCurrency(dayExpense), formatCurrency(daySales-dayExpense)];
    });
  }, [report, rangedSales, rangedPurchases, rangedExpenses, products, creditBills, totalSales, totalExpenses, totalCogs]);
  const columns = report === 'sales' ? ['Date', 'Bill', 'Customer', 'Payment', 'Total (INR)'] : report === 'purchases' ? ['Date', 'Supplier invoice', 'Supplier', 'Items', 'Total (INR)', 'Balance (INR)'] : report === 'stock' ? ['SKU', 'Product', 'Unit', 'On hand', 'Status'] : report === 'outstanding' ? ['Party type', 'Party', 'Reference', 'Due date', 'Outstanding (INR)', 'Status'] : report === 'profit' ? ['Period', 'Net sales (INR)', 'Cost of goods sold (INR)', 'Expenses (INR)', 'Net profit (INR)'] : ['Date', 'Sales (INR)', 'Expenses (INR)', 'Net (INR)'];
  const exportCsv = () => {
    const csv = [columns, ...reportRows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `able-lubes-${report}-${today}.csv`; link.click(); URL.revokeObjectURL(link.href); showToast('Report exported.');
  };

  return <div className="flex flex-col w-full gap-space-md">
    <section className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/20 flex flex-wrap gap-space-sm items-end justify-between">
      <div className="flex flex-wrap gap-space-sm items-end">
        <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">Report<select value={report} onChange={e => setReport(e.target.value as typeof report)} className="h-9 px-2 rounded border border-outline-variant/30 bg-surface-container-lowest text-on-surface"><option value="daily">Daily summary</option><option value="sales">Sales</option><option value="purchases">Purchases</option><option value="stock">Stock</option><option value="profit">Profit &amp; loss</option><option value="outstanding">Customer outstanding</option></select></label>
        <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 bg-surface-container-lowest text-on-surface" /></label>
        <label className="flex flex-col gap-1 font-label-sm text-on-surface-variant">To<input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 px-2 rounded border border-outline-variant/30 bg-surface-container-lowest text-on-surface" /></label>
      </div>
      <button type="button" onClick={exportCsv} className="h-9 px-space-md rounded bg-primary-container text-on-primary font-label-md">Export CSV</button>
    </section>
    {(report === 'daily' || report === 'profit') && <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-sm">{[
      ['Net sales', totalSales], ['Purchases', rangedPurchases.reduce((n,p)=>n+p.totalAmount,0)], ['Expenses', totalExpenses], ['Net profit*', totalSales-totalCogs-totalExpenses],
    ].map(([label,value]) => <div key={label} className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/20"><div className="font-label-sm text-on-surface-variant">{label}</div><div className="mt-1 text-title-lg font-semibold text-on-surface">{formatCurrency(Number(value))}</div></div>)}</section>}
    {report === 'profit' && <p className="text-label-sm text-on-surface-variant">*Demo estimate: sales less recorded product cost and operating expenses. Connect backend costing for authoritative profit.</p>}
    <section className="bg-surface-container-lowest rounded-lg border border-outline-variant/20 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-surface-container-low">{columns.map(col=><th key={col} className="px-space-md py-3 text-label-sm uppercase text-on-surface-variant">{col}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant/10">{reportRows.map((row,i)=><tr key={i} className="hover:bg-surface-container-low/50">{row.map((cell,j)=><td key={j} className="px-space-md py-3 text-body-md text-on-surface">{cell}</td>)}</tr>)}{!reportRows.length && <tr><td colSpan={columns.length} className="px-space-md py-10 text-center text-on-surface-variant">No records in this date range.</td></tr>}</tbody></table></div></section>
  </div>;
};
