import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileText,
  Printer,
  Plus,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ExpenseManagementView } from './ExpenseManagementView';
import { formatCurrency } from '../utils/currency';
import { getDailySalesReport } from '../services/api';

type RegisterTab = 'sales' | 'expenses';
type PaymentMode = 'all' | 'Cash' | 'Credit' | 'UPI' | 'Coupon';

const localDate = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const saleDate = (date: string | undefined, dateTime: string) =>
  (date || dateTime.slice(0, 10)).slice(0, 10);

const formatSaleDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
};

const reportDate = (date: string) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${date}T12:00:00`));

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const DailySalesManagementView: React.FC = () => {
  const { sales, expenses, showToast, authSession } = useApp();
  const today = localDate(new Date());
  const [activeTab, setActiveTab] = useState<RegisterTab>('sales');
  const [quickDate, setQuickDate] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [modeFilter, setModeFilter] = useState<PaymentMode>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [apiSales, setApiSales] = useState<typeof sales | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [openExpenseModal, setOpenExpenseModal] = useState<() => void>(() => () => {});
  const registerAddExpense = useCallback((openModal: () => void) => setOpenExpenseModal(() => openModal), []);
  const pageSize = 5;

  useEffect(() => {
    if (!authSession) { setApiSales(null); return; }
    const start = new Date(`${fromDate}T12:00:00`);
    const end = new Date(`${toDate}T12:00:00`);
    const dates: string[] = [];
    for (const cursor = new Date(start); cursor <= end && dates.length < 32; cursor.setDate(cursor.getDate() + 1)) dates.push(localDate(cursor));
    if (!dates.length) return;
    let cancelled = false;
    setApiLoading(true);
    void Promise.all(dates.map((date) => getDailySalesReport(authSession.token, date))).then((reports) => {
      if (cancelled) return;
      const rows: typeof sales = [];
      for (const report of reports) for (const invoice of report.invoices || []) {
        const products = invoice.products || [];
        const payments = invoice.payments || [];
        const totalCollected = payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
        const invoiceDiscountTotal = Math.max(
          0,
          Number(invoice.discountAmount ?? invoice.billDiscountAmount ?? 0) || 0,
        );
        const productDiscountTotal = products.reduce(
          (sum: number, product: any) =>
            sum + Math.max(0, Number(product.discountAmount || 0)),
          0,
        );
        const unallocatedDiscount = Math.max(
          0,
          invoiceDiscountTotal - productDiscountTotal,
        );
        const isCreditSettlement =
          report.date > saleDate(undefined, String(invoice.billDate || ""));
        const paymentBreakdown = payments.map((payment: any) => {
          const method = payment.method === 'COUPON' ? 'Coupon' : payment.method === 'UPI' ? 'UPI' : 'Cash';
          const code = method === 'Coupon' ? payment.notes?.match(/^Coupon code: (.+)$/)?.[1] : undefined;
          return `${isCreditSettlement ? 'Credit settlement · ' : ''}${method}${code ? ` ${code}` : ''} ${Number(payment.amount).toFixed(2)}`;
        }).join(' · ');
        const paymentDate = payments[0]?.date || invoice.billDate;
        const itemsList = products.map((product: any) =>
          `${product.productName} × ${product.displayQuantity ?? product.quantity}${product.displayUnitSymbol || product.unitSymbol ? ` ${product.displayUnitSymbol || product.unitSymbol}` : ''}`,
        ).join('\n');
        const discountAmount = productDiscountTotal + unallocatedDiscount;
        rows.push({
          id: `${report.date}-${invoice.invoiceNumber}`,
          billNumber: invoice.invoiceNumber,
          dateTime: paymentDate,
          date: report.date,
          customerName: invoice.customer,
          customerType: 'registered',
          itemsCount: products.length,
          itemsList,
          paymentMode: paymentBreakdown as any,
          amount: totalCollected,
          billTotal: Number(invoice.totalAmount || 0),
          discountAmount,
          subtotal: totalCollected,
          lineItems: [],
        });
      }
      setApiSales(rows);
    }).catch((error) => { if (!cancelled) { setApiSales([]); showToast(error instanceof Error ? error.message : 'Daily sales could not be loaded.', 'error'); } }).finally(() => { if (!cancelled) setApiLoading(false); });
    return () => { cancelled = true; };
  }, [authSession, fromDate, toDate, showToast]);

  const inRange = (date: string) => date >= fromDate && date <= toDate;
  const rangeSales = (apiSales ?? sales)
    .filter((sale) => inRange(saleDate(sale.date, sale.dateTime)))
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  const rangeExpenses = expenses.filter((expense) => inRange(expense.date.slice(0, 10)));
  const query = searchTerm.toLowerCase().trim();
  const filteredSales = rangeSales.filter((sale) => {
    const matchesMode = modeFilter === 'all' || sale.paymentMode === modeFilter || sale.paymentMode.includes(`${modeFilter} `);
    const matchesSearch = !query || sale.billNumber.toLowerCase().includes(query) || sale.customerName.toLowerCase().includes(query) || sale.itemsList.toLowerCase().includes(query);
    return matchesMode && matchesSearch;
  });
  const matchingExpenses = rangeExpenses.filter((expense) => !query || expense.description.toLowerCase().includes(query) || Boolean(expense.category?.toLowerCase().includes(query)) || Boolean(expense.notes?.toLowerCase().includes(query)));

  const pageCount = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageSales = filteredSales.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstRow = filteredSales.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(safePage * pageSize, filteredSales.length);
  const printSalesTotal = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const printExpensesTotal = matchingExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  useEffect(() => {
    setPage(1);
  }, [activeTab, fromDate, toDate, modeFilter, searchTerm]);

  const selectToday = () => {
    const date = localDate(new Date());
    setQuickDate('today');
    setFromDate(date);
    setToDate(date);
  };

  const selectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = localDate(yesterday);
    setQuickDate('yesterday');
    setFromDate(date);
    setToDate(date);
  };

  const handlePrintRegister = () => {
    const previousTitle = document.title;
    document.title = activeTab === 'sales' ? 'Able Lubes - Daily Sales Register' : 'Able Lubes - Daily Expenses Register';
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
  };

  const handleExportDaySheet = () => {
    const salesRows = [
      ['Date & Time', 'Bill Number', 'Customer', 'Product', 'Payment Received (INR)', 'Bill Total (INR)', 'Discount Given (INR)', 'Payment Mode'],
      ...filteredSales.map((sale) => [formatSaleDateTime(sale.dateTime), sale.billNumber, sale.customerName, sale.itemsList, formatCurrency(sale.amount), sale.paymentMode.includes('Credit settlement') && sale.billTotal !== undefined ? formatCurrency(sale.billTotal) : '', (sale.discountAmount || 0) > 0 ? formatCurrency(sale.discountAmount || 0) : '', sale.paymentMode]),
    ];
    const expenseRows = [
      [],
      ['Expenses'],
      ['Date', 'Description', 'Category', 'Payment Method', 'Notes', 'Amount (INR)'],
      ...matchingExpenses.map((expense) => [expense.date, expense.description, expense.category || '', expense.paymentMethod || '', expense.notes || '', formatCurrency(expense.amount)]),
    ];
    const csv = [...salesRows, ...expenseRows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daily_Register_${fromDate}_to_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Day Sheet exported successfully.');
  };

  return (
    <div className="daily-register-page w-full">
      <div className="daily-register-screen flex w-full flex-col gap-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Daily register records" className="inline-flex w-fit max-w-full items-center rounded-full border border-[#e9e3d9] bg-white p-1 shadow-[0_3px_12px_rgba(37,27,12,.08)]">
          {([
            { id: 'sales', label: 'Sales', count: rangeSales.length, icon: ShoppingCart },
            { id: 'expenses', label: 'Expenses', count: rangeExpenses.length, icon: FileText },
          ] as const).map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${activeTab === id ? 'text-[#493819]' : 'text-[#6b665c] hover:text-[#272727]'}`}
            >
              {activeTab === id && <motion.span layoutId="daily-register-tab-indicator" className="absolute inset-0 rounded-full bg-[#fff1c9] shadow-sm" transition={{ duration: 0.24, ease: 'easeOut' }} aria-hidden="true" />}
              <span className="relative z-10 inline-flex items-center gap-2"><Icon size={17} aria-hidden="true" />{label}<span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{count}</span></span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeTab === 'expenses' && <button type="button" onClick={openExpenseModal} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-3 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82]">
            <Plus size={17} aria-hidden="true" /> Add Expense
          </button>}
          <button type="button" onClick={handlePrintRegister} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e9e3d9] bg-white px-3 text-sm font-semibold text-[#272727] shadow-sm transition hover:bg-[#f8f6f2]">
            <Printer size={17} aria-hidden="true" /> Print {activeTab === 'sales' ? 'Sales' : 'Expenses'} / Save PDF
          </button>
          <button type="button" onClick={handleExportDaySheet} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-3 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82]">
            <Download size={17} aria-hidden="true" /> Export Day Sheet
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-[#e9e3d9] bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between" aria-label="Register filters">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#f5f3ef] p-1">
            <button type="button" onClick={selectToday} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${quickDate === 'today' ? 'bg-[#ffe4a0] text-[#493819] shadow-sm' : 'text-[#68645e] hover:bg-white'}`}>Today</button>
            <button type="button" onClick={selectYesterday} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${quickDate === 'yesterday' ? 'bg-[#ffe4a0] text-[#493819] shadow-sm' : 'text-[#68645e] hover:bg-white'}`}>Yesterday</button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#efdcae] bg-[#fff7e7] p-1.5">
            <label className="flex items-center gap-1.5" aria-label="From date">
              <CalendarDays size={16} className="shrink-0 text-[#89795c]" aria-hidden="true" />
              <input type="date" aria-label="From date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setQuickDate('custom'); }} className="h-8 min-w-[130px] rounded-md border border-[#ead8ad] bg-[#fffdf8] px-2 text-xs text-[#272727] outline-none focus:border-[#c58a00]" />
            </label>
            <span className="text-xs font-medium text-[#89795c]">to</span>
            <label className="flex items-center gap-1.5" aria-label="To date">
              <CalendarDays size={16} className="shrink-0 text-[#89795c]" aria-hidden="true" />
              <input type="date" aria-label="To date" value={toDate} onChange={(event) => { setToDate(event.target.value); setQuickDate('custom'); }} className="h-8 min-w-[130px] rounded-md border border-[#ead8ad] bg-[#fffdf8] px-2 text-xs text-[#272727] outline-none focus:border-[#c58a00]" />
            </label>
          </div>
          {activeTab === 'sales' && <label className="flex items-center gap-2 text-xs font-semibold text-[#77736d]" htmlFor="register-payment-mode">
            <span>Mode</span>
            <select
              id="register-payment-mode"
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value as PaymentMode)}
              className="h-9 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm font-medium text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white"
            >
              <option value="all">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
              <option value="UPI">UPI</option>
              <option value="Coupon">Coupon</option>
            </select>
          </label>}
        </div>
        <label className="relative block w-full lg:max-w-[320px]">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#89847b]" aria-hidden="true" />
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={activeTab === 'sales' ? 'Search bill, customer or product…' : 'Search expense or category…'} className="h-10 w-full rounded-lg border border-[#e8e4dd] bg-[#f7f7f6] pl-9 pr-3 text-sm text-[#272727] outline-none placeholder:text-[#89847b] focus:border-[#c58a00] focus:bg-white" aria-label={activeTab === 'sales' ? 'Search sales' : 'Search expenses'} />
        </label>
      </section>

      <AnimatePresence mode="wait" initial={false}>
      {activeTab === 'sales' ? (
        <motion.section key="sales-panel" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden rounded-xl border border-[#e9e3d9] bg-white shadow-sm" role="tabpanel" aria-label="Sales records">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead><tr className="h-10 bg-[#f6f5f2] text-xs font-bold uppercase tracking-wide text-[#6d685f]">
                <th className="px-4 py-2">Date &amp; time</th><th className="px-4 py-2">Bill number</th><th className="px-4 py-2">Product name</th><th className="px-4 py-2 text-right">Received today (₹)</th><th className="px-4 py-2 text-center">Mode of payment</th>
              </tr></thead>
              <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                {pageSales.map((item) => (
                  <tr key={item.id} className="h-11 transition hover:bg-[#fffdf8]">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-[#68645e]">{formatSaleDateTime(item.dateTime)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-semibold text-[#a86600]">{item.billNumber}</td>
                    <td className="max-w-[440px] px-4 py-2">
                      <div className="space-y-1" title={item.itemsList}>
                        {item.itemsList.split('\n').map((productName, index) => (
                          <div key={`${item.id}-${index}`} className="truncate">{productName}</div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-semibold">
                      <span>{formatCurrency(item.amount)}</span>
                      {(item.discountAmount || 0) > 0 && (
                        <span className="mt-1 block text-[11px] font-medium text-[#9a6700]">
                          Discount {formatCurrency(item.discountAmount || 0)}
                        </span>
                      )}
                      {item.paymentMode.includes('Credit settlement') && item.billTotal !== undefined && (
                        <span className="mt-1 block text-[11px] font-medium text-[#68645e]">
                          Bill total {formatCurrency(item.billTotal)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center"><span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${item.paymentMode.includes('UPI') ? 'bg-[#eee9ff] text-[#5940a5]' : item.paymentMode.includes('Cash') ? 'bg-[#f0f0ed] text-[#45443f]' : 'bg-[#eaf0ff] text-[#34549b]'}`}>
                      <span className="material-symbols-outlined text-[14px]">{item.paymentMode.includes('UPI') ? 'contactless' : item.paymentMode.includes('Cash') ? 'payments' : 'credit_card'}</span>{item.paymentMode}
                    </span></td>
                  </tr>
                ))}
                {filteredSales.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[#77736d]">No sales match this date range and filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t border-[#eee8df] bg-[#f8f7f4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b665c]">
              <span>Showing <strong className="text-[#272727]">{firstRow}-{lastRow}</strong> of <strong className="text-[#272727]">{filteredSales.length}</strong> bills</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-4">
              <div className="text-right"><div className="text-xs font-semibold uppercase tracking-wide text-[#77736d]">Grand total</div><div className="text-xl font-extrabold text-[#493819]">{formatCurrency(printSalesTotal)}</div></div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="First page" disabled={safePage === 1} onClick={() => setPage(1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8e4dd] bg-white text-[#555] disabled:cursor-not-allowed disabled:opacity-40"><ChevronsLeft size={16} /></button>
                <button type="button" aria-label="Previous page" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8e4dd] bg-white text-[#555] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="px-2 text-xs font-semibold text-[#555]">{safePage} / {pageCount}</span>
                <button type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8e4dd] bg-white text-[#555] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
                <button type="button" aria-label="Last page" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8e4dd] bg-white text-[#555] disabled:cursor-not-allowed disabled:opacity-40"><ChevronsRight size={16} /></button>
              </div>
            </div>
          </footer>
        </motion.section>
      ) : (
        <motion.div key="expenses-panel" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: 'easeOut' }} role="tabpanel" aria-label="Expense records">
          <ExpenseManagementView embedded dateRange={{ from: fromDate, to: toDate }} sharedSearchTerm={searchTerm} onRegisterAddExpense={registerAddExpense} />
        </motion.div>
      )}
      </AnimatePresence>
      </div>

      <article className="daily-register-print-only" aria-label="Printable daily register">
        <div className="register-print-heading">
          <div>
            <p className="register-print-brand">ABLE LUBES</p>
            <h1>{activeTab === 'sales' ? 'Daily Sales Register' : 'Daily Expenses Register'}</h1>
            <p>{activeTab === 'sales' ? 'Sales report' : 'Expense report'}</p>
          </div>
          <div className="register-print-meta">
            <strong>Period</strong><span>{reportDate(fromDate)} to {reportDate(toDate)}</span>
          </div>
        </div>

        {activeTab === 'sales' ? <div className="register-print-totals">
          <div><span>Total sales</span><strong>{formatCurrency(printSalesTotal)}</strong></div>
        </div> : <div className="register-print-totals">
          <div><span>Total expenses</span><strong>{formatCurrency(printExpensesTotal)}</strong></div>
        </div>}

        {activeTab === 'sales' ? <section className="register-print-section">
          <h2>Sales <span>({filteredSales.length})</span></h2>
          <table className="register-print-sales">
            <thead><tr><th>Date &amp; time</th><th>Bill number</th><th>Product name</th><th>Payment received (₹)</th><th>Bill total (₹)</th><th>Discount given (₹)</th><th>Payment mode</th></tr></thead>
            <tbody>
              {filteredSales.map((sale) => <tr key={sale.id}>
                <td>{formatSaleDateTime(sale.dateTime)}</td><td>{sale.billNumber}</td><td style={{ whiteSpace: 'pre-line' }}>{sale.itemsList}</td><td>{formatCurrency(sale.amount)}</td><td>{sale.paymentMode.includes('Credit settlement') && sale.billTotal !== undefined ? formatCurrency(sale.billTotal) : '—'}</td><td>{(sale.discountAmount || 0) > 0 ? formatCurrency(sale.discountAmount || 0) : '—'}</td><td>{sale.paymentMode}</td>
              </tr>)}
              {filteredSales.length === 0 && <tr><td colSpan={7} className="register-print-empty">No sales in this range.</td></tr>}
              {filteredSales.length > 0 && <tr><td colSpan={3}><strong>Grand total</strong></td><td><strong>{formatCurrency(printSalesTotal)}</strong></td><td /><td /><td /></tr>}
            </tbody>
          </table>
        </section> : <section className="register-print-section">
          <h2>Expenses <span>({matchingExpenses.length})</span></h2>
          <table className="register-print-expenses">
            <thead><tr><th>Date</th><th>Description</th><th>Category / payment / notes</th><th>Amount (₹)</th></tr></thead>
            <tbody>
              {matchingExpenses.map((expense) => <tr key={expense.id}>
                <td>{expense.date}</td><td>{expense.description}</td><td>{[expense.category, expense.paymentMethod, expense.notes].filter(Boolean).join(' · ') || '—'}</td><td>{formatCurrency(expense.amount)}</td>
              </tr>)}
              {matchingExpenses.length === 0 && <tr><td colSpan={4} className="register-print-empty">No expenses in this range.</td></tr>}
            </tbody>
          </table>
        </section>}
      </article>
    </div>
  );
};
