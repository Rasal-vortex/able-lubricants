import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DashboardSummary } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

interface RevenuePoint {
  date: string;
  paidSales: number;
  creditSales: number;
}

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

const RevenueTooltip: React.FC<{ active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }> = ({ active, payload, label }) => {
  if (!active || !payload?.length || !label) return null;
  const labels: Record<string, string> = { paidSales: 'Paid sales', creditSales: 'Credit sales' };
  return (
    <div className="rounded-xl border border-[#eee8df] bg-white px-3 py-2.5 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold text-[#555047]">{formatDate(label)}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-5 text-xs">
          <span className="text-[#77736d]">{labels[item.dataKey || ''] || item.dataKey}</span>
          <span className="font-semibold text-[#171717]">{formatCurrency(Number(item.value || 0))}</span>
        </div>
      ))}
    </div>
  );
};

const RevenueAxisTick: React.FC<{ x?: number; y?: number; payload?: { value?: number } }> = ({ x = 0, y = 0, payload }) => {
  const value = Number(payload?.value || 0);
  const label = value >= 1000 ? `₹${Math.round(value / 1000)}K` : `₹${Math.round(value)}`;
  return <text x={x} y={y} dy={4} textAnchor="end" fill="#77736d" fontSize={11}>{label}</text>;
};

export const SalesRevenueAreaChart: React.FC<{
  summary: DashboardSummary | null;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}> = ({ summary, selectedMonth, onMonthChange }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, offset) => {
    const month = new Date(currentYear, currentMonthIndex - offset, 1);
    return {
      value: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      label: month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  }), [currentYear, currentMonthIndex]);
  const chartData = useMemo<RevenuePoint[]>(() => (summary?.chart.days || []).map((day) => ({
    date: day.date,
    paidSales: Number(day.paidSales) || 0,
    creditSales: Number(day.creditSales) || 0,
  })), [summary]);
  const selectedMonthLabel = monthOptions.find((month) => month.value === selectedMonth)?.label || '';
  const hasMonthlySales = chartData.some((point) => point.paidSales > 0 || point.creditSales > 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#eee8df] bg-white shadow-[0_3px_14px_rgba(37,27,12,.06)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8df] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#171717]">Sales revenue</h2>
          <p className="mt-1 text-xs text-[#77736d]">Daily paid and credit sales · {selectedMonthLabel}</p>
        </div>
        <label className="sr-only" htmlFor="sales-revenue-range">Select sales chart range</label>
        <select
          id="sales-revenue-range"
          value={selectedMonth}
          onChange={(event) => onMonthChange(event.target.value)}
          className="h-9 rounded-lg border border-[#e9e3d9] bg-white px-3 text-xs font-medium text-[#37332d] outline-none focus:ring-2 focus:ring-[#e8a300]/30"
        >
          {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
        </select>
      </header>

      <div className="h-[250px] w-full px-2 pb-3 pt-4 sm:px-4 sm:pt-5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id="salesPaidFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8a300" stopOpacity={0.42} />
                <stop offset="95%" stopColor="#e8a300" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="salesCreditFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#252a2d" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#252a2d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#eee8df" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={9}
              minTickGap={8}
              tick={{ fill: '#77736d', fontSize: 11 }}
              tickFormatter={(value) => String(new Date(`${value}T12:00:00`).getDate())}
            />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={<RevenueAxisTick />}
              tickFormatter={(value: number) => value >= 1000 ? `₹${Math.round(value / 1000)}K` : `₹${value}`}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              height={30}
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs font-medium text-[#555047]">{value === 'paidSales' ? 'Paid sales' : 'Credit sales'}</span>}
            />
            <Area type="natural" dataKey="creditSales" name="creditSales" stackId="sales" stroke="#252a2d" strokeWidth={2} fill="url(#salesCreditFill)" animationDuration={1200} animationEasing="ease-out" />
            <Area type="natural" dataKey="paidSales" name="paidSales" stackId="sales" stroke="#e8a300" strokeWidth={2.5} fill="url(#salesPaidFill)" animationDuration={1200} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {summary && !hasMonthlySales && <p className="px-6 pb-4 text-center text-xs text-[#77736d]">No sales recorded for {selectedMonthLabel}.</p>}
    </section>
  );
};
