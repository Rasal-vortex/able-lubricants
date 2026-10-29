import React from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

export const ReceiptModal: React.FC = () => {
  const { activeReceiptToPrint, setActiveReceiptToPrint } = useApp();

  if (!activeReceiptToPrint) return null;

  const { title, refNumber, date, party, items, total, mode, subtotal, billDiscount } = activeReceiptToPrint;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0b1c30]/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => setActiveReceiptToPrint(null)}
    >
      <div
        className="bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/30 w-full max-w-md overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
          <div className="flex flex-col">
            <span className="font-headline-sm text-title-md font-bold text-primary">Able Lubes</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveReceiptToPrint(null)}
            className="p-1 rounded text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="py-4 space-y-3 font-body-sm text-body-sm text-on-surface">
          <div className="text-center pb-2">
            <span className="font-title-md text-body-md font-bold uppercase tracking-wider text-on-surface">
              {title || 'Official Receipt / Voucher'}
            </span>
            <p className="font-data-mono-sm text-data-mono-sm text-primary font-semibold mt-0.5">
              Ref: {refNumber}
            </p>
            <p className="font-data-mono-sm text-data-mono-sm text-outline">{date}</p>
          </div>

          <div className="p-2.5 rounded bg-surface-container-low flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Party / Customer:</span>
              <span className="font-semibold text-on-surface">{party}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Payment Mode:</span>
              <span className="font-semibold text-primary">{mode}</span>
            </div>
          </div>

          {items && items.length > 0 && (
            <div className="border border-outline-variant/30 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low font-semibold text-on-surface-variant">
                  <tr>
                    <th className="p-1.5">Item</th>
                    <th className="p-1.5 text-center">Qty</th>
                    <th className="p-1.5 text-right">Price</th>
                    <th className="p-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 font-data-mono-sm">
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 text-on-surface font-sans">{it.name}</td>
                      <td className="p-1.5 text-center">{it.qty}</td>
                      <td className="p-1.5 text-right">{formatCurrency(it.price)}</td>
                      <td className="p-1.5 text-right font-semibold">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {typeof subtotal === 'number' && typeof billDiscount === 'number' && (
            <div className="space-y-1 border-t border-outline-variant/30 pt-2 text-sm">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Bill discount</span>
                <span className="font-mono">−{formatCurrency(billDiscount)}</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-title-md text-title-md font-bold text-on-surface uppercase">Total Amount</span>
            <span className="font-data-mono-lg text-[22px] font-bold text-primary">
              {formatCurrency(Number(total))}
            </span>
          </div>

          <div className="text-center pt-3 text-[11px] text-outline">
            Computer generated audit receipt • Authorized ERP Signature
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setActiveReceiptToPrint(null)}
            className="px-3 py-1.5 rounded bg-surface-container-low font-label-md text-label-md text-on-surface-variant hover:bg-surface-container"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 rounded bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
