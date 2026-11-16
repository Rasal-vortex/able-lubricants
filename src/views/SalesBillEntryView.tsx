import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, LoaderCircle, Plus, UserRoundPlus, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { CartItem } from "../types";
import { formatCurrency } from "../utils/currency";
import { normalizeCouponCode } from "../utils/coupons";
import { NumericTextInput } from "../components/ui/NumericTextInput";
import {
  isUnitQuantityInputValid,
  isUnitQuantityValid,
} from "../utils/unitQuantity";

const isKilogramProduct = (product?: { unit?: string; unitName?: string }) => {
  const name = product?.unitName?.trim().toLowerCase();
  const unit = product?.unit?.trim().toLowerCase();
  return name === "kilogram" || name === "kilograms" || unit === "kg";
};

export const SalesBillEntryView: React.FC = () => {
  const { products, customers, addCustomer, addSale, showToast } =
    useApp();

  const [billNumber, setBillNumber] = useState(
    () => `SB-${Date.now().toString().slice(-6)}`,
  );
  const [billDate, setBillDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState<"walkin" | "registered">(
    "walkin",
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Scanner & Fast Entry
  const [stockWarning, setStockWarning] = useState("");
  const [activeProductRowId, setActiveProductRowId] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [activeProductOptionIndex, setActiveProductOptionIndex] = useState(-1);
  const [productDropdownPosition, setProductDropdownPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const firstProductSelectRef = useRef<HTMLInputElement>(null);
  const activeProductInputRef = useRef<HTMLInputElement | null>(null);

  // Cart Items
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(
    {},
  );
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  // Discounts & Coupons
  const [billDiscount, setBillDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponPrice, setCouponPrice] = useState("");
  const [couponEnabled, setCouponEnabled] = useState(false);

  // Payment Method
  const [paymentMode, setPaymentMode] = useState<
    "Cash" | "Credit" | "UPI" | "Split"
  >("Cash");
  const [splitAmounts, setSplitAmounts] = useState({
    cash: "",
    upi: "",
    coupon: "",
    credit: "",
  });
  const [upiRef, setUpiRef] = useState("");
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return due.toISOString().slice(0, 10);
  });
  const [savingSale, setSavingSale] = useState(false);

  // Recalculations
  const grossSubtotal = cartItems.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0,
  );

  const remainingBeforeCoupon = Math.max(0, grossSubtotal - billDiscount);
  const enteredCouponPrice = couponPrice.trim() ? Number(couponPrice) : 0;
  const couponDiscount = Number.isFinite(enteredCouponPrice)
    ? enteredCouponPrice
    : 0;
  const finalTotal = Math.max(0, remainingBeforeCoupon - couponDiscount);
  const splitTenderTotal =
    Number(splitAmounts.cash || 0) +
    Number(splitAmounts.upi || 0) +
    Number(splitAmounts.coupon || 0) +
    Number(splitAmounts.credit || 0);
  const quantityTotals = cartItems.reduce((totals, item) => {
    if (!item.productId) return totals;
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) return totals;
    const unitText = `${product.unitName || ""} ${product.unit || ""}`.trim().toLowerCase();
    const isKilogram = isKilogramProduct(product);
    const isLitre = /litre|liter|\bl\b/.test(unitText);
    const unitLabel = isKilogram
      ? "kg"
      : isLitre
        ? "L"
        : product.unit.match(/\(([^)]+)\)/)?.[1] || product.unitName || product.unit || "unit";
    const key = product.unitId || unitLabel.toLowerCase();
    const existing = totals.get(key);
    totals.set(key, { label: unitLabel, quantity: (existing?.quantity || 0) + item.quantity });
    return totals;
  }, new Map<string, { label: string; quantity: number }>());
  const totalQuantitySummary = Array.from(quantityTotals.values())
    .map(({ label, quantity }) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(quantity)} ${label}`)
    .join(" · ");
  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleCompleteSale();
      }
      if (e.key === "F2") {
        e.preventDefault();
        firstProductSelectRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        const nextMode = paymentMode === "Cash"
          ? "Credit"
          : paymentMode === "Credit"
            ? "UPI"
            : paymentMode === "UPI" ? "Split" : "Cash";
        setPaymentMode(nextMode);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cartItems,
    finalTotal,
    paymentMode,
    customerName,
    billNumber,
    savingSale,
  ]);

  const addBlankCartItem = () => setCartItems((previous) => [...previous, {
    id: `cart-${Date.now()}-${Math.random()}`,
    name: "",
    sku: "",
    tax: 0,
    quantity: 1,
    price: 0,
  }]);

  const handleSelectCartProduct = (rowId: string, productId: string) => {
    const row = cartItems.find((item) => item.id === rowId);
    if (!productId) return;
    const product = products.find((entry) => entry.id === productId && entry.status === "Active");
    if (!product) return;
    const existingRow = cartItems.find((item) => item.id !== rowId && item.productId === product.id);
    const otherQuantity = cartItems
      .filter((item) => item.id !== rowId && item.productId === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    const requestedQuantity = row?.productId && row.productId !== product.id ? 1 : row?.quantity ?? 1;
    const stockQuantity = Math.round(product.quantity * 1000) / 1000;
    const requestedTotal = Math.round((otherQuantity + requestedQuantity) * 1000) / 1000;
    if (requestedTotal > stockQuantity) {
      const message = `Only ${product.quantity} ${product.unit || "units"} of ${product.name} are available.`;
      setStockWarning(message);
      showToast(message, "error");
      return;
    }
    const selectedItem: CartItem = {
      id: row?.id || `cart-${Date.now()}-${Math.random()}`,
      productId: product.id,
      name: product.name,
      sku: product.sku,
      tax: 0,
      quantity: requestedQuantity,
      price: product.sellingPrice,
    };
    setCartItems((previous) => {
      if (existingRow) {
        return previous.filter((item) => item.id !== rowId).map((item) => item.id === existingRow.id
          ? { ...item, quantity: item.quantity + requestedQuantity }
          : item);
      }
      return row
        ? previous.map((item) => item.id === rowId ? selectedItem : item)
        : [...previous, selectedItem];
    });
    setQuantityDrafts((previous) => { const next = { ...previous }; delete next[rowId]; return next; });
    setPriceDrafts((previous) => { const next = { ...previous }; delete next[rowId]; return next; });
    setStockWarning("");
    setActiveProductRowId(null);
    setProductSearchQuery("");
    setActiveProductOptionIndex(-1);
    setProductDropdownPosition(null);
  };

  const updateProductDropdownPosition = (input: HTMLInputElement) => {
    const rect = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, openAbove ? spaceAbove : spaceBelow));
    setProductDropdownPosition({
      top: openAbove ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: Math.min(rect.width, window.innerWidth - 16),
      maxHeight,
    });
  };

  useEffect(() => {
    if (activeProductRowId === null) return;
    const reposition = () => {
      if (activeProductInputRef.current) updateProductDropdownPosition(activeProductInputRef.current);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [activeProductRowId]);

  const renderProductSelector = (rowId: string, selectedProductId?: string) => {
    const selectedProduct = products.find((product) => product.id === selectedProductId);
    const isOpen = activeProductRowId === rowId;
    const matchingProducts = products.filter((product) => {
      if (product.status !== "Active") return false;
      const query = productSearchQuery.trim().toLowerCase();
      return !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query) || product.brand.toLowerCase().includes(query);
    });
    return (
      <div className="relative min-w-[230px]" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setActiveProductRowId(null);
          setProductSearchQuery("");
        }
      }}>
        <input
          ref={(element) => {
            if (rowId === (cartItems[0]?.id || "")) firstProductSelectRef.current = element;
            if (isOpen) activeProductInputRef.current = element;
          }}
          type="text"
          role="combobox"
          aria-label={`Select or search product for item ${rowId ? cartItems.findIndex((item) => item.id === rowId) + 1 : 1}`}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          autoComplete="off"
          value={isOpen ? productSearchQuery : selectedProduct?.name || ""}
          placeholder="Select or search product"
          onFocus={(event) => { activeProductInputRef.current = event.currentTarget; setActiveProductRowId(rowId); setProductSearchQuery(""); setActiveProductOptionIndex(-1); updateProductDropdownPosition(event.currentTarget); }}
          onChange={(event) => { setActiveProductRowId(rowId); setProductSearchQuery(event.target.value); setActiveProductOptionIndex(-1); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActiveProductOptionIndex((current) => event.key === "ArrowDown"
                ? current >= matchingProducts.length - 1 ? 0 : current + 1
                : current <= 0 ? matchingProducts.length - 1 : current - 1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const choice = matchingProducts[activeProductOptionIndex >= 0 ? activeProductOptionIndex : 0];
              if (choice) handleSelectCartProduct(rowId, choice.id);
            } else if (event.key === "Escape") {
              setActiveProductRowId(null);
              setProductSearchQuery("");
            }
          }}
          className="h-10 w-full rounded-lg border border-[#dedbd6] bg-[#faf9f7] px-3 pr-8 text-sm font-medium text-[#272727] outline-none placeholder:font-normal placeholder:text-[#89847b] focus:border-[#c58a00] focus:bg-white"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68645e]" aria-hidden="true">▾</span>
        {isOpen && productDropdownPosition && createPortal(<div role="listbox" className="fixed z-[9999] overflow-y-auto rounded-lg border border-[#e5ded1] bg-white py-1 shadow-xl" style={{ top: productDropdownPosition.top, left: productDropdownPosition.left, width: productDropdownPosition.width, maxHeight: productDropdownPosition.maxHeight }}>
          {matchingProducts.map((product, index) => {
            const otherQuantity = cartItems.filter((item) => item.id !== rowId && item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
            const available = Math.max(0, Math.round((product.quantity - otherQuantity) * 1000) / 1000);
            const disabled = available <= 0 && selectedProductId !== product.id;
            return <button key={product.id} type="button" role="option" aria-selected={activeProductOptionIndex === index} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveProductOptionIndex(index)} onClick={() => handleSelectCartProduct(rowId, product.id)} className={`flex w-full items-center justify-between gap-3 border-b border-[#f0ede7] px-3 py-2 text-left last:border-b-0 ${disabled ? "cursor-not-allowed opacity-50" : activeProductOptionIndex === index ? "bg-[#fff1c9]" : "hover:bg-[#faf8f4]"}`}>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#272727]">{product.name}</span><span className="block truncate text-xs text-[#77736d]">{[product.brand, product.sku, product.unitName || product.unit].filter(Boolean).join(" · ")}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-semibold text-[#272727]">{formatCurrency(product.sellingPrice)}</span><span className="block text-[11px] text-[#77736d]">{disabled ? "Out of stock" : `${available} available`}</span></span>
            </button>;
          })}
          {!matchingProducts.length && <p className="px-3 py-4 text-center text-sm text-[#77736d]">No products found.</p>}
        </div>, document.body)}
      </div>
    );
  };

  const handleAddCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = newCustomerName.trim();
    if (!cleanName || savingCustomer) return;
    setSavingCustomer(true);
    try {
      await addCustomer({
        name: cleanName,
        phone: newCustomerPhone.replace(/\D/g, ""),
        address: newCustomerAddress.trim(),
      });
      setCustomerName(cleanName);
      setCustomerType("registered");
      setCustomerModalOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerAddress("");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to add the customer.", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCustomerModalKeyDown = (
    event: React.KeyboardEvent<HTMLFormElement>,
  ) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const controls = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          '[data-customer-nav="true"]:not([disabled])',
        ),
      );
      const currentIndex = controls.indexOf(target);
      if (currentIndex < 0) return;
      event.preventDefault();
      const nextIndex = Math.max(
        0,
        Math.min(controls.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)),
      );
      controls[nextIndex]?.focus();
      return;
    }

    if (event.key === "Enter" && target instanceof HTMLInputElement) {
      event.preventDefault();
      if (!savingCustomer) event.currentTarget.requestSubmit();
    }
  };

  const handleCompleteSale = async () => {
    if (savingSale) return;
    if (cartItems.length === 0) {
      showToast("Cannot complete sale with an empty cart.", "error");
      return;
    }
    if (cartItems.some((item) => !item.productId)) {
      showToast("Select a product for each invoice item.", "error");
      return;
    }
    const invalidPriceDraft = cartItems.some((item) => {
      const draft = priceDrafts[item.id];
      return draft !== undefined && !/^\d+(?:\.\d{1,2})?$/.test(draft);
    });
    if (invalidPriceDraft || cartItems.some((item) => !Number.isFinite(item.price) || item.price < 0)) {
      showToast("Enter a valid non-negative price with up to two decimal places for each product.", "error");
      return;
    }
    const invalidQuantityDraft = cartItems.some((item) => {
      const draft = quantityDrafts[item.id];
      if (draft === undefined) return false;
      const product = products.find((entry) => entry.id === item.productId);
      const allowsDecimals = product?.unitAllowsDecimals ?? false;
      const gramEntry = isKilogramProduct(product);
      const enteredQuantity = Number(draft);
      const quantity = gramEntry ? enteredQuantity / 1000 : enteredQuantity;
      return (
        !draft ||
        (gramEntry ? !/^\d+$/.test(draft) : !isUnitQuantityInputValid(draft, allowsDecimals)) ||
        quantity <= 0 ||
        quantity > (product?.quantity ?? 0)
      );
    });
    if (invalidQuantityDraft) {
      showToast(
        "Review the sale quantities; one or more entries are invalid or exceed stock.",
        "error",
      );
      return;
    }

    if (
      (paymentMode === "Credit" ||
        (paymentMode === "Split" && Number(splitAmounts.credit || 0) > 0)) &&
      (customerType !== "registered" || !customerName)
    ) {
      showToast(
        "Choose a registered customer before creating a credit bill.",
        "error",
      );
      return;
    }
    if (customerType === "registered" && !customerName) {
      showToast("Choose a registered customer for this sale.", "error");
      return;
    }
    const normalizedCouponCode = normalizeCouponCode(couponCode);
    const couponCodeProvided = normalizedCouponCode.length > 0;
    const couponPriceProvided = couponPrice.trim().length > 0;
    if (couponCodeProvided !== couponPriceProvided) {
      showToast(
        "Enter both the coupon code and its amount, or leave both blank.",
        "error",
      );
      return;
    }
    if (
      couponPriceProvided &&
      (!Number.isFinite(enteredCouponPrice) || enteredCouponPrice <= 0)
    ) {
      showToast("Coupon amount must be greater than zero.", "error");
      return;
    }
    if (normalizedCouponCode.length > 80) {
      showToast("Coupon codes can be at most 80 characters.", "error");
      return;
    }
    if (couponPriceProvided && enteredCouponPrice > remainingBeforeCoupon) {
      showToast(
        "Coupon discount cannot exceed the remaining sale value.",
        "error",
      );
      return;
    }
    if (
      paymentMode === "Split" &&
      Math.abs(splitTenderTotal - finalTotal) > 0.01
    ) {
      showToast(
        "Cash, UPI, and Coupon must add up to the bill total.",
        "error",
      );
      return;
    }
    const splitCouponAmount = Number(splitAmounts.coupon || 0);
    const itemNames = cartItems
      .map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        const gramEntry = isKilogramProduct(product);
        return `${item.name} (×${gramEntry ? `${Math.round(item.quantity * 1000)} g` : `${item.quantity} ${product?.unitName || product?.unit || ""}`})`;
      })
      .join(", ");

    setSavingSale(true);
    try {
      const saved = await addSale({
        billNumber,
        date: billDate,
        dateTime: `${billDate} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        customerName: customerName.trim() || "Walk-in Customer",
        customerType: customerName.trim() ? "registered" : "walkin",
        itemsCount: cartItems.length,
        itemsList: itemNames,
        paymentMode,
        ...(paymentMode === "Split"
          ? {
              paymentTenders: [
                {
                  method: "CASH" as const,
                  amount: Number(splitAmounts.cash || 0),
                },
                {
                  method: "UPI" as const,
                  amount: Number(splitAmounts.upi || 0),
                },
                ...(Number(splitAmounts.coupon || 0) > 0
                  ? [
                      {
                        method: "COUPON" as const,
                        amount: Number(splitAmounts.coupon),
                      },
                    ]
                  : []),
              ].filter((tender) => tender.amount > 0),
            }
          : {}),
        upiRef:
          paymentMode === "UPI" && upiRef.trim() ? upiRef.trim() : undefined,
        amount: finalTotal,
        billTotal: finalTotal,
        subtotal: grossSubtotal,
        ...(couponCodeProvided
          ? {
              couponCode: normalizedCouponCode,
              couponPrice: enteredCouponPrice,
            }
          : {}),
        discountAmount: billDiscount,
        billDiscountAmount: billDiscount,
        cashReceived: paymentMode === "Cash" ? finalTotal : undefined,
        changeGiven: paymentMode === "Cash" ? 0 : undefined,
        creditDueDate:
          paymentMode === "Credit" ||
          (paymentMode === "Split" && Number(splitAmounts.credit || 0) > 0)
            ? creditDueDate
            : undefined,
        lineItems: cartItems.map((item) => {
          const product = products.find(
            (entry) => entry.id === item.productId,
          )!;
          return {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity: item.quantity,
            ...(isKilogramProduct(product)
              ? {
                  displayQuantity: Math.round(item.quantity * 1000),
                  displayUnitName: "Gram",
                  displayUnitSymbol: "g",
                }
              : {}),
            sellingPrice: item.price,
            purchaseRate: product.purchaseRate,
            tax: 0,
          };
        }),
      });

      if (saved) {
        setBillNumber(`SB-${Date.now().toString().slice(-6)}`);
        setBillDate(new Date().toISOString().slice(0, 10));
        setCartItems([]);
        setBillDiscount(0);
        setSplitAmounts({ cash: "", upi: "", coupon: "", credit: "" });
        setPriceDrafts({});
        setCouponCode("");
        setCouponPrice("");
        setCouponEnabled(false);
        setUpiRef("");
      }
    } finally {
      setSavingSale(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <section className="rounded-2xl border border-[#e9e3d9] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1fr]">
          <div className="min-w-0">
            <label htmlFor="customer-search" className="mb-1 block text-sm font-semibold text-[#272727]">Customer</label>
            <div className="flex min-w-0 gap-2">
              <select id="customer-search" className="h-11 min-w-0 flex-1 rounded-lg border border-[#dedbd6] bg-[#faf9f7] px-3 text-sm text-[#272727] outline-none focus:border-[#c58a00]" value={customerName} onChange={(event) => { setCustomerName(event.target.value); setCustomerType(event.target.value ? "registered" : "walkin"); }}>
                <option value="">Walk-in / no customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.name}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}
              </select>
              <button type="button" onClick={() => setCustomerModalOpen(true)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#e9d6a6] bg-[#fff1c9] px-3 text-sm font-semibold text-[#493819] transition hover:bg-[#ffe4a0]" aria-label="Add customer"><Plus size={16} /><span>Add customer</span></button>
            </div>
          </div>
          <label htmlFor="bill-date" className="flex flex-col gap-1 text-sm font-semibold text-[#272727]">Date
            <span className="flex h-11 items-center gap-2 rounded-lg border border-[#dedbd6] bg-[#faf9f7] px-3 text-sm font-semibold text-[#272727]">
              <CalendarDays size={18} className="shrink-0 text-[#493819]" aria-hidden="true" />
              <input id="bill-date" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
            </span>
          </label>
        </div>
      </section>

        {/* Invoice item rows */}
        <section className="relative z-10 overflow-visible rounded-2xl border border-[#e9e3d9] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee8df] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1c9] text-[#b27800]"><span className="material-symbols-outlined text-[22px]">inventory_2</span></span>
              <h2 className="text-lg font-bold text-[#171717]">Invoice items</h2>
              <span className="rounded-full bg-[#fff7e7] px-3 py-1 font-mono text-xs font-semibold text-[#9a6700]">{cartItems.filter((item) => item.productId).length} items</span>
            </div>
            <button type="button" disabled={cartItems.length === 0} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-[#a12626] transition hover:bg-red-50 disabled:opacity-40" onClick={() => { setCartItems([]); showToast("Cart cleared", "info"); }}>
              <span className="material-symbols-outlined text-[17px]">delete_sweep</span>Clear cart
            </button>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-2 px-space-md w-10 text-center">#</th>
                  <th className="py-2 px-space-md min-w-[230px]">Product</th>
                  <th className="py-2 px-space-sm">Brand</th>
                  <th className="py-2 px-space-sm w-36 text-center">Qty</th>
                  <th className="py-2 px-space-sm w-24 text-center">Unit</th>
                  <th className="py-2 px-space-sm w-28 text-right">Price</th>
                  <th className="py-2 px-space-md w-28 text-right">Total</th>
                  <th className="py-2 px-space-sm w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {cartItems.map((item, index) => {
                  const net = item.quantity * item.price;
                  const product = products.find(
                    (entry) => entry.id === item.productId,
                  );
                  const allowsDecimals = product?.unitAllowsDecimals ?? false;
                  const gramEntry = isKilogramProduct(product);
                  const quantityScale = gramEntry ? 1000 : 1;
                  const minimumInputQuantity = gramEntry ? 1 : allowsDecimals ? 0.001 : 1;
                  const minimumQuantity = minimumInputQuantity / quantityScale;
                  const quantityIncrement = (gramEntry ? 1 : allowsDecimals ? 0.1 : 1) / quantityScale;
                  const displayUnit = gramEntry ? "g" : product?.unitName || product?.unit || "unit";
                  const inputQuantity =
                    quantityDrafts[item.id] ?? String(gramEntry ? Math.round(item.quantity * quantityScale) : item.quantity);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-container-low transition-colors"
                    >
                      <td className="py-2 px-space-md text-center font-data-mono-sm text-data-mono-sm text-on-surface-variant">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="py-2 px-space-md">
                        {renderProductSelector(item.id, item.productId)}
                      </td>
                      <td className="py-2 px-space-sm">
                        <span className="rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">
                          {product?.brand || "—"}
                        </span>
                      </td>
                      <td className="py-2 px-space-sm">
                        <div className="flex items-center justify-center gap-1 rounded-lg border border-[#dedbd6] bg-[#faf9f7] p-1">
                          <button
                            type="button"
                            disabled={!product}
                            className="flex h-7 w-7 items-center justify-center rounded bg-white text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
                            onClick={() => {
                              setQuantityDrafts((previous) => {
                                const next = { ...previous };
                                delete next[item.id];
                                return next;
                              });
                              setCartItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id
                                    ? {
                                        ...it,
                                        quantity: Math.max(
                                          minimumQuantity,
                                          Math.round((it.quantity - quantityIncrement) * 1000) / 1000,
                                        ),
                                      }
                                    : it,
                                ),
                              );
                            }}
                          >
                            -
                          </button>
                          <NumericTextInput
                            disabled={!product}
                            maxDecimals={gramEntry ? 0 : allowsDecimals ? 3 : 0}
                            aria-label={`Quantity in ${displayUnit}`}
                            className="w-16 text-center font-data-mono-md text-data-mono-md bg-transparent text-on-surface focus:outline-none"
                            value={inputQuantity}
                            onValueChange={(raw) => {
                              setQuantityDrafts((previous) => ({
                                ...previous,
                                [item.id]: raw,
                              }));
                              const entered = Number(raw);
                              const requested = entered / quantityScale;
                              const validInput = gramEntry
                                ? /^\d+$/.test(raw)
                                : isUnitQuantityInputValid(raw, allowsDecimals);
                              if (!raw || !validInput) {
                                setStockWarning(
                                  gramEntry
                                    ? "Enter grams as a whole number."
                                    : allowsDecimals
                                    ? "Use no more than 3 decimal places for this quantity."
                                    : "This unit only allows whole-number quantities.",
                                );
                                return;
                              }
                              const maximum = product?.quantity ?? 0;
                              if (
                                requested < minimumQuantity ||
                                requested > maximum
                              ) {
                                const message =
                                  requested > maximum
                                    ? `Only ${maximum} ${product?.unit || "units"} of ${item.name} are available.`
                                    : "Quantity must be greater than zero.";
                                setStockWarning(message);
                              } else {
                                setStockWarning("");
                                setCartItems((prev) =>
                                  prev.map((it) =>
                                    it.id === item.id
                                      ? { ...it, quantity: requested }
                                      : it,
                                  ),
                                );
                              }
                            }}
                            onBlur={() => {
                              const raw = quantityDrafts[item.id];
                              if (raw === undefined) return;
                              const entered = Number(raw);
                              const requested = entered / quantityScale;
                              const validInput = gramEntry
                                ? /^\d+$/.test(raw)
                                : isUnitQuantityInputValid(raw, allowsDecimals);
                              if (
                                !raw ||
                                !validInput ||
                                requested < minimumQuantity ||
                                requested > (product?.quantity ?? 0)
                              ) {
                                setQuantityDrafts((previous) => {
                                  const next = { ...previous };
                                  delete next[item.id];
                                  return next;
                                });
                              } else {
                                setCartItems((previous) =>
                                  previous.map((it) =>
                                    it.id === item.id
                                      ? { ...it, quantity: requested }
                                      : it,
                                  ),
                                );
                                setQuantityDrafts((previous) => {
                                  const next = { ...previous };
                                  delete next[item.id];
                                  return next;
                                });
                              }
                            }}
                          />
                          <button
                            type="button"
                            aria-label={`Increase ${item.name} quantity`}
                            title={
                              item.quantity >= (product?.quantity ?? 0)
                                ? "Maximum available stock reached"
                                : "Increase quantity"
                            }
                            disabled={!product}
                            className="flex h-7 w-7 items-center justify-center rounded bg-white text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40"
                            onClick={() => {
                              setQuantityDrafts((previous) => {
                                const next = { ...previous };
                                delete next[item.id];
                                return next;
                              });
                              if (
                                product &&
                                item.quantity >= product.quantity
                              ) {
                                const message = `Only ${product.quantity} ${product.unit || "units"} of ${product.name} are available.`;
                                setStockWarning(message);
                                showToast(message, "error");
                                return;
                              }
                              setCartItems((prev) =>
                                prev.map((it) =>
                                  it.id === item.id
                                    ? {
                                        ...it,
                                        quantity: Math.min(
                                          product?.quantity ??
                                            it.quantity + quantityIncrement,
                                          Math.round(
                                            (it.quantity + quantityIncrement) *
                                              1000,
                                          ) / 1000,
                                        ),
                                      }
                                    : it,
                                ),
                              );
                              setStockWarning("");
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-xs font-medium text-[#68645e]">{product ? displayUnit : "—"}</td>
                      <td className="py-2 px-space-sm text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          disabled={!product}
                          aria-label={`Selling price for ${item.name}`}
                          className="w-20 text-right font-data-mono-md text-data-mono-md bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                          value={priceDrafts[item.id] ?? String(item.price)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!/^\d*(?:\.\d{0,2})?$/.test(raw)) return;
                            setPriceDrafts((previous) => ({ ...previous, [item.id]: raw }));
                            if (raw && raw !== ".") {
                              const val = Number(raw);
                              setCartItems((prev) => prev.map((it) => it.id === item.id ? { ...it, price: val } : it));
                            }
                          }}
                          onBlur={() => {
                            const raw = priceDrafts[item.id];
                            if (raw === undefined) return;
                            if (/^\d+(?:\.\d{1,2})?$/.test(raw)) {
                              const val = Number(raw);
                              setCartItems((prev) => prev.map((it) => it.id === item.id ? { ...it, price: val } : it));
                            }
                            setPriceDrafts((previous) => {
                              const next = { ...previous };
                              delete next[item.id];
                              return next;
                            });
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
                          onClick={() =>
                            setCartItems((prev) =>
                              prev.filter((it) => it.id !== item.id),
                            )
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            delete
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {cartItems.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-center text-sm text-[#77736d]">1</td>
                    <td className="px-3 py-2">
                      {renderProductSelector("")}
                    </td>
                    <td className="px-3 py-2 text-center text-[#77736d]">—</td><td className="px-3 py-2 text-center text-[#77736d]">—</td><td className="px-3 py-2 text-center text-[#77736d]">—</td><td className="px-3 py-2 text-right text-[#77736d]">—</td><td className="px-3 py-2 text-right font-semibold">₹0</td><td className="px-3 py-2 text-center text-[#77736d]">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {stockWarning && (
            <p
              role="alert"
              className="mx-4 mt-2 rounded-md bg-error-container/40 px-3 py-2 text-sm text-error"
            >
              {stockWarning}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee8df] px-4 py-3">
            <button type="button" onClick={addBlankCartItem} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e9d6a6] bg-white px-4 text-sm font-semibold text-[#493819] transition hover:bg-[#fff7e7]"><Plus size={17} aria-hidden="true" />Add another item</button>
            <p className="text-sm text-[#68645e]">Total quantity: <strong className="text-[#272727]">{totalQuantitySummary || "0"}</strong></p>
          </div>
        </section>

      {/* Bill summary and checkout stay at the top of the right column. */}
      <div className="contents">
        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-[#e9e3d9] bg-white p-4 shadow-sm lg:grid-cols-2">
          <div className="order-2 lg:order-2">
            <span className="font-title-md text-title-md font-semibold text-on-surface block mb-2">
              Summary
            </span>
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-space-xs font-body-md text-body-md border border-outline-variant/20">
              <div className="flex items-center justify-between py-1 text-on-surface-variant">
                <span>Subtotal</span>
                <span className="font-data-mono-md text-data-mono-md text-on-surface">
                  {formatCurrency(grossSubtotal)}
                </span>
              </div>
              <label
                className="flex items-center justify-between gap-3 py-1 text-sm text-on-surface-variant"
                htmlFor="bill-discount"
              >
                <span>Discount (₹)</span>
                <input
                  id="bill-discount"
                  type="number"
                  min="0"
                  max={grossSubtotal}
                  step="1"
                  value={billDiscount || ""}
                  placeholder="0"
                  onChange={(e) => {
                    if (!/^\d*$/.test(e.target.value)) return;
                    setBillDiscount(
                      Math.min(
                        grossSubtotal,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    );
                  }}
                  className="h-9 w-32 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-right text-base font-semibold text-on-surface outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={couponEnabled}
                aria-controls={couponEnabled ? "sale-coupon-fields" : undefined}
                onClick={() => {
                  const enabled = !couponEnabled;
                  setCouponEnabled(enabled);
                  if (!enabled) {
                    setCouponCode("");
                    setCouponPrice("");
                  }
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-outline-variant/25 bg-surface-container-lowest px-3 py-2 text-left shadow-sm transition hover:shadow-md"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    confirmation_number
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-on-surface">
                      Coupon discount
                    </span>
                    <span className="block text-[11px] text-on-surface-variant">
                      {couponEnabled
                        ? "Enter a code and amount"
                        : "Add a coupon code"}
                    </span>
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${couponEnabled ? "bg-[#c88b00]" : "bg-[#c7c4be]"}`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${couponEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`}
                  />
                </span>
              </button>

              {couponEnabled && (
                <div
                  id="sale-coupon-fields"
                  className="rounded-lg border border-[#eee5d4] bg-white p-3 shadow-[0_4px_14px_rgba(37,27,12,.08)] animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className="flex flex-col gap-1 text-xs text-on-surface-variant"
                      htmlFor="sale-coupon-code"
                    >
                      Coupon code
                      <input
                        id="sale-coupon-code"
                        value={couponCode}
                        onChange={(event) =>
                          setCouponCode(normalizeCouponCode(event.target.value))
                        }
                        maxLength={80}
                        placeholder="coupon code"
                        className="h-8 min-w-0 rounded border border-outline-variant/30 px-2 font-mono uppercase text-on-surface outline-none focus:border-primary"
                      />
                    </label>
                    <label
                      className="flex flex-col gap-1 text-xs text-on-surface-variant"
                      htmlFor="sale-coupon-price"
                    >
                      Amount (₹)
                      <input
                        id="sale-coupon-price"
                        type="number"
                        min="1"
                        step="1"
                        value={couponPrice}
                        onChange={(event) => {
                          if (/^\d*$/.test(event.target.value))
                            setCouponPrice(event.target.value);
                        }}
                        placeholder="0"
                        className="h-8 min-w-0 rounded border border-outline-variant/30 px-2 text-right text-on-surface outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-on-surface-variant">
                    Enter the coupon code and discount amount.
                  </p>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Coupon discount</span>
                  <span className="font-data-mono-md text-data-mono-md text-on-surface">
                    −{formatCurrency(couponDiscount)}
                  </span>
                </div>
              )}

              {couponEnabled &&
                couponPrice.trim() &&
                (!Number.isFinite(enteredCouponPrice) ||
                  enteredCouponPrice <= 0) && (
                  <p role="alert" className="text-xs text-error">
                    Enter an amount greater than zero.
                  </p>
                )}
              {couponEnabled &&
                couponPrice.trim() &&
                enteredCouponPrice > remainingBeforeCoupon && (
                  <p role="alert" className="text-xs text-error">
                    Coupon discount cannot exceed the remaining sale value.
                  </p>
                )}

              <div className="h-px bg-surface-container-high my-1"></div>

              {/* Grand Total */}
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[17px] font-extrabold tracking-wide text-on-surface uppercase sm:text-[19px]">
                  Final Bill Total
                </span>
                <span className="text-[40px] font-extrabold tracking-tight text-[#171717] font-data-mono-lg leading-none sm:text-[44px]">
                  {formatCurrency(finalTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="order-1 flex flex-col gap-3 lg:order-1">
          {/* Select how the customer pays */}
          <div>
            <label className="font-label-md text-on-surface block mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/20 sm:grid-cols-4">
              {(["Cash", "Credit", "UPI", "Split"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPaymentMode(mode);
                  }}
                  className={`py-1.5 px-2 rounded font-label-md text-label-md font-semibold flex items-center justify-center gap-1 transition-all ${
                    paymentMode === mode
                      ? "bg-primary-container text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {mode === "Cash"
                      ? "payments"
                      : mode === "Credit"
                        ? "account_balance_wallet"
                        : mode === "UPI"
                          ? "qr_code_scanner"
                          : "payments"}
                  </span>
                  <span>{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {paymentMode === "Split" && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
              {(["cash", "upi", "coupon", "credit"] as const).map((mode) => (
                <label
                  key={mode}
                  className="text-xs font-semibold text-on-surface-variant"
                >
                  {mode === "coupon" ? "Coupon amount (₹)" : `${mode.toUpperCase()} amount (₹)`}
                  <NumericTextInput
                    maxDecimals={0}
                    value={splitAmounts[mode]}
                    onValueChange={(value) => setSplitAmounts((current) => ({ ...current, [mode]: value }))}
                    className="mt-1 h-11 w-full rounded border border-outline-variant/30 bg-white px-2 text-right text-lg font-semibold text-on-surface"
                  />
                </label>
              ))}
              {Number(splitAmounts.credit || 0) > 0 &&
                (customerType !== "registered" || !customerName) && (
                <p className="col-span-2 text-xs text-on-surface-variant">
                  Select a registered customer above. The Credit amount will be
                  added to their balance.
                </p>
              )}
              <p className="col-span-2 text-sm text-on-surface-variant">
                Entered: <span className="text-base font-semibold text-on-surface">{formatCurrency(splitTenderTotal)} / {formatCurrency(finalTotal)}</span>
              </p>
            </div>
          )}

          {/* Payment Details Subpanel */}
          {paymentMode === "Credit" && (
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2">
              {!customerName ? (
                <p role="status" className="text-sm text-on-surface-variant">
                  Select a registered customer to create this credit sale.
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  {formatCurrency(finalTotal)} will be added to{" "}
                  <strong className="text-on-surface">{customerName}</strong>’s credit balance.
                </p>
              )}
            </div>
          )}

          {paymentMode === "UPI" && (
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
          </div>

          {/* Action Buttons */}
          <div className="order-3 pt-1 lg:col-start-2 lg:row-start-2">
            <button
              type="button"
              disabled={savingSale || !cartItems.length || cartItems.some((item) => !item.productId)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ffc21a] text-base font-bold text-[#171717] shadow-sm transition hover:bg-[#ffb900] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCompleteSale}
            >
              <span className="material-symbols-outlined text-[20px]">
                {savingSale ? "hourglass_top" : "check_circle"}
              </span>
              <span>{savingSale ? "Saving sale…" : "Complete sale"}</span>
            </button>
          </div>
        </section>
      </div>
      {customerModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150"
          onClick={() => { if (!savingCustomer) setCustomerModalOpen(false); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-add-customer-title"
            onSubmit={handleAddCustomer}
            onKeyDown={handleCustomerModalKeyDown}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-low px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-primary"><UserRoundPlus size={20} /></span>
                <h2 id="billing-add-customer-title" className="text-lg font-semibold text-on-surface">Add customer</h2>
              </div>
              <button type="button" aria-label="Close" disabled={savingCustomer} onClick={() => setCustomerModalOpen(false)} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-50"><X size={18} /></button>
            </div>
            <div className="grid gap-4 p-5">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface-variant">Customer name
                <input data-customer-nav="true" required autoFocus value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} className="h-11 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary focus:bg-white" placeholder="Business or person name" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface-variant">Phone number <span className="font-normal">(optional)</span>
                <input data-customer-nav="true" type="text" inputMode="numeric" pattern="[0-9]*" value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value.replace(/\D/g, ""))} onPaste={(event) => { event.preventDefault(); setNewCustomerPhone(event.clipboardData.getData("text").replace(/\D/g, "")); }} className="h-11 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary focus:bg-white" placeholder="Digits only" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface-variant">Address
                <input data-customer-nav="true" required value={newCustomerAddress} onChange={(event) => setNewCustomerAddress(event.target.value)} className="h-11 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary focus:bg-white" placeholder="Customer address" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-outline-variant/20 bg-surface-container-low px-5 py-4">
              <button type="button" disabled={savingCustomer} onClick={() => setCustomerModalOpen(false)} className="h-10 rounded-lg border border-outline-variant/30 bg-white px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50">Cancel</button>
              <button data-customer-nav="true" type="submit" disabled={savingCustomer} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-container px-4 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-primary disabled:opacity-60">
                {savingCustomer ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
                {savingCustomer ? "Saving…" : "Save customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
