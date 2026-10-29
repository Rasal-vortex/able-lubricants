import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

export const DailySalesManagementView: React.FC = () => {
  const { sales, showToast } = useApp();

  const isoDate = (date: Date) => { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };

  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [modeFilter, setModeFilter] = useState<'all' | 'Cash' | 'Credit' | 'UPI'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter sales
  const filteredSales = sales.filter((sale) => {
    const date = sale.date || sale.dateTime.slice(0, 10);
    if (dateFilter !== 'custom' && date !== selectedDate) return false;
    if (dateFilter === 'custom' && date !== selectedDate) return false;
    // Mode match
    const matchesMode = modeFilter === 'all' || sale.paymentMode === modeFilter;

    // Search match
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      sale.billNumber.toLowerCase().includes(q) ||
      sale.customerName.toLowerCase().includes(q) ||
      sale.itemsList.toLowerCase().includes(q);

    return matchesMode && matchesSearch;
  });

  // Calculate running cumulative totals
  let runningSum = 0;
  const salesWithRunningTotal = [...filteredSales].reverse().map((sale) => {
    runningSum += sale.amount;
    return { ...sale, runningTotal: runningSum };
  }).reverse();

  const totalSettled = filteredSales.filter(s => s.paymentMode !== 'Credit').reduce((sum, s) => sum + s.amount, 0);

  const handleExportDaySheet = () => {
    const rows = [
      ['Date & Time', 'Bill Number', 'Customer', 'Items Breakdown', 'Amount (INR)', 'Payment Mode', 'Cumulative Sales (INR)'],
      ...salesWithRunningTotal.map((s) => [
        `"${s.dateTime}"`,
        s.billNumber,
        `"${s.customerName.replace(/"/g, '""')}"`,
        `"${s.itemsList.replace(/"/g, '""')}"`,
        formatCurrency(s.amount),
        s.paymentMode,
        formatCurrency(s.runningTotal),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daily_Sales_Sheet_${selectedDate}.csv`;
    link.click();
    showToast('Day Sheet exported successfully.');
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-end gap-space-md mb-space-lg">
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            className="h-8 px-space-md bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md rounded flex items-center gap-space-xs transition-colors shadow-sm border border-outline-variant/30"
            type="button"
            onClick={() => window.print()}
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">print</span>
            <span>Print Register</span>
          </button>
          <button
            className="h-8 px-space-md bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded flex items-center gap-space-xs transition-colors shadow-sm"
            type="button"
            onClick={handleExportDaySheet}
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export Day Sheet</span>
          </button>
        </div>
      </header>

      {/* Filter & Operational Toolbar */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md mb-space-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md border border-outline-variant/20">
        {/* Date Quick Selectors & Picker */}
        <div className="flex flex-wrap items-center gap-space-xs">
          <div className="bg-surface-container-low p-0.5 rounded-lg flex items-center text-on-surface-variant font-label-md text-label-md border border-outline-variant/20">
            <button
              className={`px-space-md py-1 rounded transition-all ${
                dateFilter === 'today'
                  ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => {
                setDateFilter('today');
                setSelectedDate(isoDate(new Date()));
              }}
              type="button"
            >
              Today
            </button>
            <button
              className={`px-space-md py-1 rounded transition-all ${
                dateFilter === 'yesterday'
                  ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => {
                setDateFilter('yesterday');
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); setSelectedDate(isoDate(yesterday));
              }}
              type="button"
            >
              Yesterday
            </button>
          </div>

          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2 text-outline text-[16px] pointer-events-none">
              calendar_today
            </span>
            <input
              aria-label="Select custom date"
              className="h-8 pl-7 pr-space-sm bg-surface-container-low text-on-surface font-data-mono-sm text-data-mono-sm rounded focus:bg-surface-container-lowest outline-none transition-colors border border-outline-variant/20"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setDateFilter('custom');
              }}
            />
          </div>

          <div className="h-4 w-px bg-surface-container-high mx-space-xs hidden sm:block"></div>

          {/* Payment Mode Filters */}
          <div className="flex items-center gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant mr-1 uppercase tracking-wider">
              Mode:
            </span>
            {(['all', 'Cash', 'Credit', 'UPI'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={`h-7 px-space-sm rounded font-label-md text-label-md transition-colors ${
                  modeFilter === m
                    ? 'bg-primary text-on-primary font-medium'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
                }`}
              >
                {m === 'all' ? 'All Modes' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Shift Meta */}
        <div className="flex items-center gap-space-sm">
          <div className="relative w-full lg:w-80">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              className="w-full h-8 pl-8 pr-7 bg-surface-container-low text-on-surface font-body-md text-body-md rounded placeholder:text-outline-variant focus:bg-surface-container-lowest outline-none transition-colors border border-outline-variant/20"
              placeholder="Search by bill number, product name..."
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                onClick={() => setSearchTerm('')}
              >
                <span className="material-symbols-outlined text-[14px]">cancel</span>
              </button>
            )}
          </div>
         
        </div>
      </div>

      {/* Tabular Daily Sales Interface */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-9 bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider select-none">
                <th className="px-space-md py-1 font-semibold w-44" scope="col">
                  Date
                </th>
                <th className="px-space-md py-1 font-semibold w-32" scope="col">
                  Bill Number
                </th>
                <th className="px-space-md py-1 font-semibold" scope="col">
                  Product Name
                </th>
                <th className="px-space-md py-1 font-semibold text-right w-32" scope="col">
                  Amount (₹)
                </th>
                <th className="px-space-md py-1 font-semibold text-center w-36" scope="col">
                  Mode of Payment
                </th>
                <th className="px-space-md py-1 font-semibold text-right w-36" scope="col">
                  Total Sales (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low text-body-md font-body-md text-on-surface">
              {salesWithRunningTotal.map((item) => (
                <tr key={item.id} className="h-10 hover:bg-surface-container-lowest/60 transition-colors group">
                  <td className="px-space-md py-2 font-data-mono-sm text-data-mono-sm text-on-surface-variant whitespace-nowrap">
                    {item.dateTime}
                  </td>
                  <td className="px-space-md py-2">
                    <span className="font-data-mono-md text-data-mono-md font-semibold text-primary">
                      {item.billNumber}
                    </span>
                  </td>
                  <td className="px-space-md py-2 text-on-surface">
                    <span className="truncate block max-w-xl">{item.itemsList}</span>
                  </td>
                  <td className="px-space-md py-2 text-right font-data-mono-md text-data-mono-md font-medium text-on-surface">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="px-space-md py-2 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-data-mono-sm text-data-mono-sm font-medium ${
                        item.paymentMode === 'UPI'
                          ? 'bg-surface-variant text-primary'
                          : item.paymentMode === 'Cash'
                          ? 'bg-surface-container-high text-on-surface'
                          : 'bg-secondary-fixed text-on-secondary-fixed-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {item.paymentMode === 'UPI'
                          ? 'contactless'
                          : item.paymentMode === 'Cash'
                          ? 'payments'
                          : 'credit_card'}
                      </span>
                      <span>{item.paymentMode}</span>
                    </span>
                  </td>
                  <td className="px-space-md py-2 text-right font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                    {formatCurrency(item.runningTotal)}
                  </td>
                </tr>
              ))}
              {salesWithRunningTotal.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-on-surface-variant font-body-sm">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-1 block">find_in_page</span>
                    No daily sales matching criteria found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Summary Footer & Pagination */}
        <footer className="h-12 px-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm border-t border-outline-variant/20">
          <div className="flex items-center gap-space-md">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Showing <span className="font-data-mono-sm font-medium text-on-surface">1</span>-
              <span className="font-data-mono-sm font-medium text-on-surface">{filteredSales.length}</span> of{' '}
              <span className="font-data-mono-sm font-medium text-on-surface">{sales.length}</span> daily sales
            </span>
            <span className="hidden md:inline-block text-outline-variant">•</span>
            <span className="hidden md:inline-flex items-center gap-1 font-data-mono-sm text-data-mono-sm text-on-surface-variant">
              Payments received on selected date:{' '}
              <span className="font-semibold text-primary">
                {formatCurrency(totalSettled)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              aria-label="First page"
              className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-outline-variant cursor-not-allowed"
              disabled
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">first_page</span>
            </button>
            <button
              aria-label="Previous page"
              className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-outline-variant cursor-not-allowed"
              disabled
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <div className="flex items-center gap-1 px-1">
              <button
                className="w-7 h-7 rounded bg-primary text-on-primary font-data-mono-sm text-data-mono-sm font-semibold flex items-center justify-center"
                type="button"
              >
                1
              </button>
              <button
                className="w-7 h-7 rounded hover:bg-surface-container-lowest text-on-surface font-data-mono-sm text-data-mono-sm flex items-center justify-center transition-colors"
                type="button"
              >
                2
              </button>
              <button
                className="w-7 h-7 rounded hover:bg-surface-container-lowest text-on-surface font-data-mono-sm text-data-mono-sm flex items-center justify-center transition-colors"
                type="button"
              >
                3
              </button>
            </div>
            <button
              aria-label="Next page"
              className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
            <button
              aria-label="Last page"
              className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">last_page</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
