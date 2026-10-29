import React from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatMoney = formatCurrency;

export const DashboardView: React.FC = () => {
  const { sales, expenses, creditBills, purchases, products, partyLedger, setActiveScreen } = useApp();
  const today = todayISO();
  const todaySales = sales.filter((sale) => (sale.date || sale.dateTime.slice(0, 10)) === today);
  const salesTotal = todaySales.reduce((total, sale) => total + sale.amount, 0);
  const todayReceipts = [
    ...sales.filter((sale) => (sale.date || sale.dateTime.slice(0, 10)) === today && sale.paymentMode !== 'Credit').map((sale) => sale.amount),
    ...partyLedger.filter((row) => row.transactionType === 'PAYMENTS' && row.paymentDate !== '-' && new Date(row.paymentDate).toDateString() === new Date(`${today}T12:00:00`).toDateString()).map((row) => row.amountPaid),
  ].reduce((sum, amount) => sum + amount, 0);
  const todayExpenses = expenses.filter((expense) => expense.date === today).reduce((total, expense) => total + expense.amount, 0);
  const customerOutstanding = creditBills.reduce((total, bill) => total + bill.netDue, 0);
  const supplierPayable = purchases.reduce((total, bill) => total + (bill.outstandingBalance || 0), 0);
  const lowStock = products.filter((product) => product.status === 'Active' && product.quantity <= (product.minThreshold ?? 0));

  const metrics = [
    { label: "Today's sales", value: formatMoney(salesTotal), detail: `Received ${formatMoney(todayReceipts)}`, icon: 'payments' },
    { label: "Today's expenses", value: formatMoney(todayExpenses), detail: 'For the selected date', icon: 'account_balance_wallet' },
    { label: 'Customer outstanding', value: formatMoney(customerOutstanding), detail: `${creditBills.filter((bill) => bill.netDue > 0).length} open invoices`, icon: 'credit_card' },
    { label: 'Supplier payable', value: formatMoney(supplierPayable), detail: `${purchases.filter((bill) => (bill.outstandingBalance || 0) > 0).length} open bills`, icon: 'local_shipping' },
  ];

  return (
    <div className="flex flex-col w-full gap-space-lg">
      <section className="flex flex-wrap items-center gap-2" aria-label="Quick actions">
        <button type="button" onClick={() => setActiveScreen('sales-bill-entry')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-white hover:bg-primary-container text-[12px]">
          <span className="material-symbols-outlined text-[16px]">add</span>New bill
        </button>
        <button type="button" onClick={() => setActiveScreen('purchase-bill-entry')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-outline-variant bg-white hover:bg-surface-container-low text-on-surface text-[12px]">
          <span className="material-symbols-outlined text-[16px]">add</span>New purchase
        </button>
        <button type="button" onClick={() => setActiveScreen('product-entry')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-outline-variant bg-white hover:bg-surface-container-low text-on-surface text-[12px]">
          <span className="material-symbols-outlined text-[16px]">inventory_2</span>Add product
        </button>
        <button type="button" onClick={() => setActiveScreen('party-ledger-management')} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-outline-variant bg-white hover:bg-surface-container-low text-on-surface text-[12px]">
          <span className="material-symbols-outlined text-[16px]">payments</span>Receive payment
        </button>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Business summary">
        {metrics.map((metric) => (
          <article key={metric.label} className="min-w-0 bg-white border border-outline-variant rounded-lg px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-on-surface-variant">{metric.label}</span>
              <span className="material-symbols-outlined text-[17px] text-on-surface-variant">{metric.icon}</span>
            </div>
            <div className="mt-2 text-[21px] leading-7 font-semibold tracking-tight text-on-surface">{metric.value}</div>
            <div className="mt-1 text-[11px] text-on-surface-variant">{metric.detail}</div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-outline-variant rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
            <h2 className="font-semibold text-[14px]">Recent sales</h2>
            <button type="button" onClick={() => setActiveScreen('daily-sales-management')} className="text-[12px] text-primary font-medium">View sales</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-container-low text-on-surface-variant"><tr><th className="px-3 py-2 font-medium">Invoice</th><th className="px-3 py-2 font-medium">Customer</th><th className="px-3 py-2 font-medium">Payment</th><th className="px-3 py-2 text-right font-medium">Total</th></tr></thead>
              <tbody className="divide-y divide-outline-variant">
                {sales.slice(0, 5).map((sale) => <tr key={sale.id} className="hover:bg-surface-container-low">
                  <td className="px-3 py-2.5 font-medium text-primary">{sale.billNumber}</td><td className="px-3 py-2.5">{sale.customerName}</td><td className="px-3 py-2.5">{sale.paymentMode}</td><td className="px-3 py-2.5 text-right">{formatMoney(sale.amount)}</td>
                </tr>)}
                {sales.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-on-surface-variant">No sales recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-outline-variant rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
            <h2 className="font-semibold text-[14px]">Recent purchases</h2>
            <button type="button" onClick={() => setActiveScreen('purchase-bill-entry')} className="text-[12px] text-primary font-medium">View purchases</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-container-low text-on-surface-variant"><tr><th className="px-3 py-2 font-medium">Purchase</th><th className="px-3 py-2 font-medium">Supplier</th><th className="px-3 py-2 text-right font-medium">Total</th><th className="px-3 py-2 text-right font-medium">Outstanding</th></tr></thead>
              <tbody className="divide-y divide-outline-variant">
                {purchases.slice(0, 5).map((purchase) => <tr key={purchase.id} className="hover:bg-surface-container-low">
                  <td className="px-3 py-2.5 font-medium">{purchase.invoiceNumber}</td><td className="px-3 py-2.5">{purchase.partyName}</td><td className="px-3 py-2.5 text-right">{formatMoney(purchase.totalAmount)}</td><td className="px-3 py-2.5 text-right">{formatMoney(purchase.outstandingBalance || 0)}</td>
                </tr>)}
                {purchases.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-on-surface-variant">No purchases recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white border border-outline-variant rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
          <div><h2 className="font-semibold text-[14px]">Low-stock products</h2><p className="mt-0.5 text-[11px] text-on-surface-variant">Active products at or below their configured threshold</p></div>
          <button type="button" onClick={() => setActiveScreen('product-entry')} className="text-[12px] text-primary font-medium">Inventory</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-surface-container-low text-on-surface-variant"><tr><th className="px-3 py-2 font-medium">Product</th><th className="px-3 py-2 font-medium">SKU</th><th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 text-right font-medium">Current stock</th><th className="px-3 py-2 text-right font-medium">Threshold</th></tr></thead>
            <tbody className="divide-y divide-outline-variant">
              {lowStock.map((product) => <tr key={product.id} className="hover:bg-surface-container-low"><td className="px-3 py-2.5 font-medium">{product.name}</td><td className="px-3 py-2.5 text-on-surface-variant">{product.sku || '—'}</td><td className="px-3 py-2.5">{product.unit}</td><td className="px-3 py-2.5 text-right text-error font-semibold">{product.quantity}</td><td className="px-3 py-2.5 text-right">{product.minThreshold ?? '—'}</td></tr>)}
              {lowStock.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-on-surface-variant">No products are below their stock threshold.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
