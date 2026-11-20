import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Product } from '../../types';

type StockHealthBarChartProps = {
  products: Product[];
  loading: boolean;
  error: string | null;
};

const StockTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: { name: string; currentStock: number; unit: string } }>;
}> = ({ active, payload }) => {
  const product = payload?.[0]?.payload;
  if (!active || !product) return null;
  return (
    <div className="rounded-xl border border-[#eee8df] bg-white px-3 py-2.5 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-[#37332d]">{product.name}</p>
      <p className="text-xs text-[#77736d]">Available stock: <span className="font-semibold text-[#171717]">{product.currentStock} {product.unit}</span></p>
      <p className="mt-1 text-[11px] text-[#77736d]">Minimum stock requirement is not configured.</p>
    </div>
  );
};

export const StockHealthBarChart: React.FC<StockHealthBarChartProps> = ({ products, loading, error }) => {
  const chartData = useMemo(() => products
    .filter((product) => product.status === 'Active')
    .map((product) => ({
      name: product.name,
      currentStock: Number.isFinite(product.quantity) ? product.quantity : 0,
      unit: product.unit || 'units',
    }))
    .sort((left, right) => left.currentStock - right.currentStock || left.name.localeCompare(right.name))
    .slice(0, 8), [products]);

  const chartHeight = Math.max(190, chartData.length * 38 + 26);

  return (
    <div className="px-5 pb-5 sm:px-6">
      <p className="mb-3 rounded-lg border border-[#f1dfb4] bg-[#fffaf0] px-3 py-2 text-xs leading-relaxed text-[#765000]">
        Minimum stock requirements aren’t configured in the product data. Showing current available stock, with the lowest quantities first; low-stock status can’t be determined yet.
      </p>
      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#77736d]" role="status">Loading inventory…</div>
      ) : error ? (
        <div className="flex h-36 items-center justify-center rounded-xl bg-red-50 px-4 text-center text-sm text-red-700" role="alert">{error}</div>
      ) : chartData.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-xl bg-[#fffdfa] px-4 text-center text-sm text-[#77736d]">No active products to display.</div>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 34, bottom: 0, left: 4 }} barCategoryGap={10} accessibilityLayer>
              <CartesianGrid horizontal={false} stroke="#eee8df" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#77736d', fontSize: 11 }} allowDecimals />
              <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fill: '#555047', fontSize: 11 }} interval={0} />
              <Tooltip content={<StockTooltip />} cursor={{ fill: '#fff8e7' }} />
              <Bar dataKey="currentStock" name="Available stock" fill="#e8a300" radius={[0, 5, 5, 0]} maxBarSize={21}>
                <LabelList dataKey="currentStock" position="right" fill="#555047" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!loading && !error && chartData.length > 0 && <p className="mt-2 text-[11px] text-[#77736d]">Current available stock · {chartData.length} of {products.filter((product) => product.status === 'Active').length} active products</p>}
    </div>
  );
};
