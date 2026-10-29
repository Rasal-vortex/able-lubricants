import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CartItem } from '../types';
import { formatCurrency } from '../utils/currency';

export const SalesBillEntryView: React.FC = () => {
  const { products, customers, addSale, showToast, setActiveReceiptToPrint } = useApp();

  const [billNumber, setBillNumber] = useState(() => `SB-${Date.now().toString().slice(-6)}`);
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<'walkin' | 'registered'>('walkin');

  // Scanner & Fast Entry
  const [fastSearchQuery, setFastSearchQuery] = useState('');
  const [quickQty, setQuickQty] = useState(1);
  const [showAutoSuggest, setShowAutoSuggest] = useState(false);
  const [stockWarning, setStockWarning] = useState('');
  const fastInputRef = useRef<HTMLInputElement>(null);

  // Cart Items
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Discounts & Coupons
  const [billDiscount, setBillDiscount] = useState(0);

  // Payment Method
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Credit' | 'UPI'>('Cash');
  const [upiRef, setUpiRef] = useState('');
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const due = new Date(); due.setDate(due.getDate() + 14); return due.toISOString().slice(0, 10);
  });
  const [cashReceived, setCashReceived] = useState(0);
  const [cashReceivedManuallySet, setCashReceivedManuallySet] = useState(false);

  // Recalculations
  const grossSubtotal = cartItems.reduce((acc, item) => {
    const gross = item.quantity * item.price;
    const net = gross - gross * (item.discount / 100);
    return acc + net;
  }, 0);

  const finalTotal = Math.max(0, grossSubtotal - billDiscount);
  const totalUnits = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const changeToReturn = cashReceived - finalTotal;

  useEffect(() => {
    if (!cashReceivedManuallySet) setCashReceived(finalTotal);
  }, [finalTotal, cashReceivedManuallySet]);

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleCompleteSale();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        fastInputRef.current?.focus();
        fastInputRef.current?.select();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        const nextMode = paymentMode === 'Cash' ? 'Credit' : paymentMode === 'Credit' ? 'UPI' : 'Cash';
        setPaymentMode(nextMode);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, finalTotal, paymentMode, customerName, billNumber, cashReceived]);

  // Quick scanner suggestion filtering
  const matchingCatalog = fastSearchQuery.trim()
    ? products
        .filter((p) => p.status === 'Active')
        .filter(
          (p) =>
            p.name.toLowerCase().includes(fastSearchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(fastSearchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(fastSearchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const handleAddItemToCart = (product: { id: string; name: string; sku: string; unit: string; sellingPrice: number; quantity: number }, qty = 1) => {
    if (!Number.isInteger(qty) || qty < 1) {
      showToast('Quantity must be at least one.', 'error');
      return;
    }
    const existingIndex = cartItems.findIndex((it) => it.productId === product.id);
    const alreadyInCart = existingIndex >= 0 ? cartItems[existingIndex].quantity : 0;
    if (alreadyInCart + qty > product.quantity) {
      const message = `Only ${product.quantity} ${product.unit || 'units'} of ${product.name} available. ${alreadyInCart} already in this sale.`;
      setStockWarning(message);
      showToast(message, 'error');
      return;
    }
    setStockWarning('');
    if (existingIndex >= 0) {
      setCartItems((prev) =>
        prev.map((it, idx) => (idx === existingIndex ? { ...it, quantity: it.quantity + qty } : it))
      );
    } else {
      const newItem: CartItem = {
        id: 'cart-' + Date.now() + Math.random(),
        name: product.name,
        sku: product.sku,
        productId: product.id,
        tax: 0,
        quantity: qty,
        price: product.sellingPrice,
        discount: 0,
      };
      setCartItems((prev) => [...prev, newItem]);
    }
    showToast(`Added ${product.name} (x${qty}) to cart.`);
    setFastSearchQuery('');
    setShowAutoSuggest(false);
  };

  const handleQuickAdd = () => {
    if (matchingCatalog.length > 0) {
      handleAddItemToCart(matchingCatalog[0], quickQty);
    } else {
      showToast('No matching active product found.', 'error');
    }
  };

  const getCartQuantity = (productId: string) =>
    cartItems.filter((item) => item.productId === productId).reduce((total, item) => total + item.quantity, 0);

  const handleCompleteSale = async () => {
    if (cartItems.length === 0) {
      showToast('Cannot complete sale with an empty cart.', 'error');
      return;
    }

    if (paymentMode === 'Credit' && (customerType !== 'registered' || !customerName)) {
      showToast('Choose a registered customer before creating a credit bill.', 'error');
      return;
    }
    if (customerType === 'registered' && !customerName) {
      showToast('Choose a registered customer for this sale.', 'error');
      return;
    }
    if (paymentMode === 'Cash' && cashReceived < finalTotal) {
      showToast('Cash received must cover the bill total.', 'error');
      return;
    }
    const itemNames = cartItems.map((c) => `${c.name} (x${c.quantity})`).join(', ');

    const saved = await addSale({
      billNumber,
      date: billDate,
      dateTime: `${billDate} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerType: customerName.trim() ? 'registered' : 'walkin',
      itemsCount: cartItems.length,
      itemsList: itemNames,
      paymentMode,
      upiRef: paymentMode === 'UPI' && upiRef.trim() ? upiRef.trim() : undefined,
      amount: finalTotal,
      subtotal: grossSubtotal,
      discountAmount: cartItems.reduce((sum, item) => sum + item.quantity * item.price * (item.discount / 100), 0) + billDiscount,
      billDiscountAmount: billDiscount,
      cashReceived: paymentMode === 'Cash' ? cashReceived : undefined,
      changeGiven: paymentMode === 'Cash' ? Math.max(0, changeToReturn) : undefined,
      creditDueDate: paymentMode === 'Credit' ? creditDueDate : undefined,
      lineItems: cartItems.map((item) => {
        const product = products.find((entry) => entry.id === item.productId)!;
        return { productId: product.id, name: product.name, sku: product.sku, unit: product.unit, quantity: item.quantity, sellingPrice: item.price, purchaseRate: product.purchaseRate, discount: item.discount, tax: 0 };
      }),
    });

    if (saved) {
      setBillNumber(`SB-${Date.now().toString().slice(-6)}`);
      setBillDate(new Date().toISOString().slice(0, 10));
      setCartItems([]);
      setBillDiscount(0);
      setUpiRef('');
      setCashReceivedManuallySet(false);
    }
  };

  const handlePrintCurrentReceipt = () => {
    setActiveReceiptToPrint({
      title: 'Retail Bill',
      refNumber: billNumber,
      date: billDate + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      party: customerName,
      items: cartItems.map((c) => ({
        name: c.name,
        qty: c.quantity,
        price: c.price,
        total: c.quantity * c.price * (1 - c.discount / 100),
      })),
      subtotal: grossSubtotal,
      billDiscount,
      total: finalTotal,
      mode: paymentMode,
    });
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
    
      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <section className="grid grid-cols-1 gap-space-md rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-space-md shadow-sm sm:grid-cols-3 xl:col-span-9">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container/10 text-primary">
              <span className="material-symbols-outlined">receipt_long</span>
            </span>
            <div>
              <div className="text-sm text-on-surface-variant">Bill reference</div>
              <strong className="font-mono text-primary">{billNumber}</strong>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant" htmlFor="bill-date">
            Issue date
            <input id="bill-date" type="date" className="h-10 rounded-md border border-outline-variant/30 bg-surface-container-low px-3 font-mono text-on-surface" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant" htmlFor="customer-search">
            Customer (optional)
            <select id="customer-search" className="h-10 rounded-md border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustomerType(e.target.value ? 'registered' : 'walkin'); }}>
              <option value="">Walk-in / no customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
            </select>
          </label>
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-space-md shadow-sm xl:col-span-3" aria-label="Customer type">
          <div className="grid h-full min-h-11 grid-cols-2 gap-1 rounded-lg bg-surface-container-low p-1">
            <button type="button" onClick={() => { setCustomerType('walkin'); setCustomerName(''); }} className={`flex items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold transition-colors ${customerType === 'walkin' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-lg">person</span> Walk-in
            </button>
            <button type="button" onClick={() => setCustomerType('registered')} className={`flex items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold transition-colors ${customerType === 'registered' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-lg">groups</span> Registered
            </button>
          </div>
        </section>
      </div>

      {/* Main POS Transaction Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        {/* Left Column: add products and review the cart */}
        <div className="lg:col-span-8 flex flex-col gap-space-md">
          {/* Fast Product Scanner Toolbar */}
          <section className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm border border-outline-variant/20">
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">barcode_scanner</span>
                  <span>Add Products</span>
                </label>
                <span className="text-xs text-on-surface-variant">Scan or search by name, SKU, or brand</span>
              </div>
              <div className="flex items-center gap-space-sm relative">
                <div className="relative flex-1">
                  <input
                    ref={fastInputRef}
                    autoComplete="off"
                    type="text"
                    className="w-full h-9 pl-3 pr-20 bg-surface-container-low rounded font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                    placeholder="Scan barcode or search product by name, SKU, or brand..."
                    value={fastSearchQuery}
                    onChange={(e) => {
                      setFastSearchQuery(e.target.value);
                      setShowAutoSuggest(e.target.value.trim().length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAdd();
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-outline">
                    <kbd className="font-data-mono-sm text-[10px] bg-surface-container px-1 py-0.5 rounded">
                      Enter ↵
                    </kbd>
                  </div>
                </div>

                <div className="w-24 flex items-center bg-surface-container-low rounded px-2 h-9 border border-outline-variant/30">
                  <span className="font-label-sm text-label-sm text-on-surface-variant mr-1">Qty</span>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-transparent font-data-mono-md text-data-mono-md text-on-surface text-center focus:outline-none"
                    value={quickQty}
                    onChange={(e) => setQuickQty(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                <button
                  type="button"
                  className="h-9 px-space-md bg-primary-container text-on-primary rounded font-label-md text-label-md font-semibold hover:bg-primary transition-colors flex items-center gap-1"
                  onClick={handleQuickAdd}
                >
                  <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                  <span>Add</span>
                </button>
              </div>

              {/* Suggestions dropdown */}
              {showAutoSuggest && matchingCatalog.length > 0 && (
                <div className="relative">
                  <div className="absolute top-1 left-0 right-0 z-30 bg-surface-container-lowest rounded-lg shadow-xl border border-outline-variant/30 p-1">
                    <div className="p-space-xs font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low rounded mb-1 flex justify-between">
                      <span>Choose a product</span>
                      <span>Available stock</span>
                    </div>
                    {matchingCatalog.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddItemToCart(prod, quickQty)}
                        className="w-full p-2 rounded hover:bg-surface-container cursor-pointer flex items-center justify-between text-left"
                      >
                        <div className="flex flex-col">
                          <span className="font-body-md text-body-md font-semibold text-on-surface">{prod.name}</span>
                          <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                            {prod.sku} • Available: {Math.max(0, prod.quantity - getCartQuantity(prod.id))} / {prod.quantity}
                          </span>
                        </div>
                        <span className="font-data-mono-md text-data-mono-md font-bold text-primary">
                          {formatCurrency(prod.sellingPrice)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Cart Line Items Table */}
          <section className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden border border-outline-variant/20">
            <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <span className="font-title-md text-title-md font-semibold text-on-surface">Bill Items</span>
                <span className="font-data-mono-sm text-data-mono-sm bg-surface-container-high text-primary px-2 py-0.5 rounded-full font-semibold">
                  {cartItems.length} items
                </span>
              </div>
              <button
                type="button"
                className="font-label-sm text-label-sm text-error hover:bg-error-container/40 px-2 py-1 rounded transition-colors flex items-center gap-1"
                onClick={() => {
                  setCartItems([]);
                  showToast('Cart cleared', 'info');
                }}
              >
                <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                <span>Clear cart</span>
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    <th className="py-2 px-space-md w-10 text-center">#</th>
                    <th className="py-2 px-space-md min-w-[180px]">Product Name</th>
                    <th className="py-2 px-space-sm">Brand</th>
                    <th className="py-2 px-space-sm w-32 text-center">Quantity</th>
                    <th className="py-2 px-space-sm w-28 text-right">Price</th>
                    <th className="py-2 px-space-sm w-24 text-right">Disc (%)</th>
                    <th className="py-2 px-space-md w-28 text-right">Total</th>
                    <th className="py-2 px-space-sm w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {cartItems.map((item, index) => {
                    const gross = item.quantity * item.price;
                    const net = gross - gross * (item.discount / 100);
                    return (
                      <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-2 px-space-md text-center font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="py-2 px-space-md">
                          <div className="flex flex-col">
                            <span className="font-title-md text-body-md font-semibold text-on-surface">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-space-sm">
                          <span className="rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">
                            {products.find((product) => product.id === item.productId)?.brand || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-space-sm">
                          <div className="flex items-center justify-center gap-1 bg-surface-container-low rounded p-0.5 border border-outline-variant/30">
                            <button
                              type="button"
                              className="w-6 h-6 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-bold text-xs"
                              onClick={() => {
                                setCartItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it
                                  )
                                );
                              }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={products.find((product) => product.id === item.productId)?.quantity ?? 0}
                              className="w-10 text-center font-data-mono-md text-data-mono-md bg-transparent text-on-surface focus:outline-none"
                              value={item.quantity}
                              onChange={(e) => {
                                const product = products.find((entry) => entry.id === item.productId);
                                const requested = parseInt(e.target.value) || 1;
                                const maximum = product?.quantity ?? 0;
                                if (requested > maximum) {
                                  const message = `Only ${maximum} ${product?.unit || 'units'} of ${item.name} are available.`;
                                  setStockWarning(message);
                                  showToast(message, 'error');
                                } else {
                                  setStockWarning('');
                                }
                                const val = Math.min(Math.max(1, requested), Math.max(1, maximum));
                                setCartItems((prev) =>
                                  prev.map((it) => (it.id === item.id ? { ...it, quantity: val } : it))
                                );
                              }}
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${item.name} quantity`}
                              title={item.quantity >= (products.find((product) => product.id === item.productId)?.quantity ?? 0) ? 'Maximum available stock reached' : 'Increase quantity'}
                              className="w-6 h-6 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-bold text-xs"
                              onClick={() => {
                                const product = products.find((entry) => entry.id === item.productId);
                                if (product && item.quantity >= product.quantity) {
                                  const message = `Only ${product.quantity} ${product.unit || 'units'} of ${product.name} are available.`;
                                  setStockWarning(message);
                                  showToast(message, 'error');
                                  return;
                                }
                                setCartItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id ? { ...it, quantity: it.quantity + 1 } : it
                                  )
                                );
                                setStockWarning('');
                              }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-space-sm text-right">
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 text-right font-data-mono-md text-data-mono-md bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                            value={item.price}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setCartItems((prev) =>
                                prev.map((it) => (it.id === item.id ? { ...it, price: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td className="py-2 px-space-sm text-right">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            className="w-16 text-right font-data-mono-md text-data-mono-md bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                            value={item.discount || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setCartItems((prev) =>
                                prev.map((it) => (it.id === item.id ? { ...it, discount: val } : it))
                              );
                            }}
                          />
                        </td>
                        <td className="py-2 px-space-md text-right font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                          {formatCurrency(net)}
                        </td>
                        <td className="py-2 px-space-sm text-center">
                          <button
                            type="button"
                            className="text-outline hover:text-error transition-colors p-1 rounded"
                            onClick={() => setCartItems((prev) => prev.filter((it) => it.id !== item.id))}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cartItems.length === 0 && (
                    <tr>
                        <td colSpan={8} className="text-center py-8 text-on-surface-variant font-body-sm">
                        No products added yet. Search above and choose a product to start the sale.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {stockWarning && (
              <p role="alert" className="mx-space-md mt-2 rounded-md bg-error-container/40 px-3 py-2 text-sm text-error">
                {stockWarning}
              </p>
            )}

            <div className="bg-surface-container-low px-space-md py-2 text-right text-sm text-on-surface-variant border-t border-outline-variant/20">
              Total quantity: <strong className="text-on-surface">{totalUnits}</strong>
            </div>
          </section>
        </div>

        {/* Right Column: Checkout, Calculation Breakdown & Payment (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-space-md">
          <section className="bg-surface-container-lowest p-space-md rounded-lg shadow-sm flex flex-col gap-space-md border border-outline-variant/20">
            <div>
              <span className="font-title-md text-title-md font-semibold text-on-surface block mb-2">
                Billing Summary
              </span>
              <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-space-xs font-body-md text-body-md border border-outline-variant/20">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span className="font-data-mono-md text-data-mono-md font-medium text-on-surface">
                    {formatCurrency(grossSubtotal)}
                  </span>
                </div>

                <div className="py-1">
                  <label className="flex items-center justify-between gap-2 text-on-surface-variant" htmlFor="bill-discount"><span>Bill discount (₹)</span><input id="bill-discount" type="number" min="0" max={grossSubtotal} step="0.01" value={billDiscount || ''} placeholder="0" onChange={e=>setBillDiscount(Math.min(grossSubtotal,Math.max(0,Number(e.target.value)||0)))} className="h-7 w-24 px-2 text-right bg-surface-container-lowest rounded border border-outline-variant/30 text-on-surface" /></label>
                </div>

                <div className="h-px bg-surface-container-high my-1"></div>

                {/* Grand Total */}
                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-title-md text-title-md font-bold text-on-surface uppercase">
                    Final Bill Total
                  </span>
                  <span className="font-display-lg text-display-lg font-bold text-primary font-data-mono-lg leading-none">
                    {formatCurrency(finalTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Select how the customer pays */}
            <div>
              <label className="font-label-md text-on-surface block mb-1.5">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/20">
                {(['Cash', 'Credit', 'UPI'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setPaymentMode(mode);
                    }}
                    className={`py-1.5 px-2 rounded font-label-md text-label-md font-semibold flex items-center justify-center gap-1 transition-all ${
                      paymentMode === mode
                        ? 'bg-primary-container text-on-primary'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {mode === 'Cash' ? 'payments' : mode === 'Credit' ? 'account_balance' : 'qr_code_scanner'}
                    </span>
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMode === 'Cash' && (
              <div className="flex flex-col gap-space-xs rounded-lg border border-outline-variant/20 bg-surface-container-low p-space-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium text-on-surface" htmlFor="cash-received">Amount Received (₹)</label>
                </div>
                <input id="cash-received" type="number" min={finalTotal} step="0.01" value={cashReceived || ''} placeholder="0" onChange={(e) => { setCashReceivedManuallySet(true); setCashReceived(Math.max(0, Number(e.target.value) || 0)); }} className="h-11 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-lg font-semibold text-on-surface" />
                <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${changeToReturn >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-error-container/40 text-error'}`}>
                  <span>Change to Return</span>
                  <strong className="font-mono">{changeToReturn < 0 ? `-${formatCurrency(Math.abs(changeToReturn))}` : formatCurrency(changeToReturn)}</strong>
                </div>
              </div>
            )}

            {/* Payment Details Subpanel */}
            {paymentMode === 'Credit' && (
              <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/20">
                {!customerName ? (
                  <label className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant" htmlFor="credit-customer">
                    Select a registered customer <span className="text-error">Required</span>
                    <select
                      id="credit-customer"
                      className="h-10 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-3 text-on-surface"
                      value=""
                      required
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerType('registered');
                      }}
                    >
                      <option value="" disabled>Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.name}>
                          {customer.name}{customer.phone ? ` · ${customer.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    Credit sale for <strong className="text-on-surface">{customerName}</strong>.
                  </p>
                )}
                <div className="flex flex-col mt-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant mb-1">
                    Payment due date
                  </label>
                  <input
                    type="date"
                    className="h-8 px-2 bg-surface-container-lowest rounded font-data-mono-sm text-data-mono-sm text-on-surface focus:outline-none border border-outline-variant/30"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                  />
                </div>
                <div className="p-2 bg-surface-container-highest rounded text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-[16px] text-primary">info</span>
                  <span>The unpaid balance will be added to this customer’s account.</span>
                </div>
              </div>
            )}

            {paymentMode === 'UPI' && (
              <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/20">
                <div className="flex flex-col">
                  <label className="font-label-sm text-label-sm text-on-surface-variant mb-1">
                    UPI transaction reference (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 428901849129"
                    className="h-8 px-2 bg-surface-container-lowest rounded font-data-mono-md text-data-mono-md text-on-surface placeholder:text-outline focus:outline-none border border-outline-variant/30"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-space-xs pt-1">
              <button
                type="button"
                disabled={cartItems.length === 0}
                className="w-full min-h-11 bg-primary-container text-on-primary rounded-lg font-title-md text-title-md font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-space-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleCompleteSale}
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>Complete sale</span>
              </button>

              <div className="grid grid-cols-1 gap-space-xs">
                <button
                  type="button"
                  className="h-8 px-space-sm bg-surface-container text-on-surface rounded font-label-md text-label-md font-medium hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1"
                  onClick={handlePrintCurrentReceipt}
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
