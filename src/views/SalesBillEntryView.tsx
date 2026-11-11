import React, { useState, useEffect, useRef } from "react";
import { Package } from "lucide-react";
import { useApp } from "../context/AppContext";
import { CartItem } from "../types";
import { formatCurrency } from "../utils/currency";
import { normalizeCouponCode } from "../utils/coupons";
import {
  isUnitQuantityInputValid,
  isUnitQuantityValid,
  quantityStep,
} from "../utils/unitQuantity";

const isKilogramProduct = (product?: { unit?: string; unitName?: string }) => {
  const name = product?.unitName?.trim().toLowerCase();
  const unit = product?.unit?.trim().toLowerCase();
  return name === "kilogram" || name === "kilograms" || unit === "kg";
};

export const SalesBillEntryView: React.FC = () => {
  const { products, customers, addSale, showToast, setActiveReceiptToPrint } =
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

  // Scanner & Fast Entry
  const [fastSearchQuery, setFastSearchQuery] = useState("");
  const [showAutoSuggest, setShowAutoSuggest] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [stockWarning, setStockWarning] = useState("");
  const fastInputRef = useRef<HTMLInputElement>(null);

  // Cart Items
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(
    {},
  );

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
  const [splitCouponCode, setSplitCouponCode] = useState("");
  const [creditPaidNow, setCreditPaidNow] = useState<string | null>(null);
  const [creditPaidMethod, setCreditPaidMethod] = useState<"CASH" | "UPI">(
    "CASH",
  );
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
  const totalUnits = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleCompleteSale();
      }
      if (e.key === "F2") {
        e.preventDefault();
        fastInputRef.current?.focus();
        fastInputRef.current?.select();
      }
      if (e.key === "F4") {
        e.preventDefault();
        const nextMode =
          paymentMode === "Cash"
            ? "Credit"
            : paymentMode === "Credit"
              ? "UPI"
              : "Cash";
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

  // Quick scanner suggestion filtering
  const matchingCatalog = fastSearchQuery.trim()
    ? products
        .filter((p) => p.status === "Active")
        .filter(
          (p) =>
            p.name.toLowerCase().includes(fastSearchQuery.toLowerCase()) ||
            p.sku.toLowerCase().includes(fastSearchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(fastSearchQuery.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  const handleAddItemToCart = (
    product: {
      id: string;
      name: string;
      sku: string;
      unit: string;
      sellingPrice: number;
      quantity: number;
      unitAllowsDecimals?: boolean;
    },
    qty = 1,
  ) => {
    const allowsDecimals = product.unitAllowsDecimals ?? false;
    if (qty <= 0 || !isUnitQuantityValid(qty, allowsDecimals)) {
      showToast(
        allowsDecimals
          ? "Enter a positive quantity with up to 3 decimal places."
          : "This unit only allows whole-number quantities.",
        "error",
      );
      return;
    }
    const existingIndex = cartItems.findIndex(
      (it) => it.productId === product.id,
    );
    const alreadyInCart =
      existingIndex >= 0 ? cartItems[existingIndex].quantity : 0;
    if (alreadyInCart + qty > product.quantity) {
      const message = `Only ${product.quantity} ${product.unit || "units"} of ${product.name} available. ${alreadyInCart} already in this sale.`;
      setStockWarning(message);
      showToast(message, "error");
      return;
    }
    setStockWarning("");
    if (existingIndex >= 0) {
      setCartItems((prev) =>
        prev.map((it, idx) =>
          idx === existingIndex ? { ...it, quantity: it.quantity + qty } : it,
        ),
      );
    } else {
      const newItem: CartItem = {
        id: "cart-" + Date.now() + Math.random(),
        name: product.name,
        sku: product.sku,
        productId: product.id,
        tax: 0,
        quantity: qty,
        price: product.sellingPrice,
      };
      setCartItems((prev) => [...prev, newItem]);
    }
    setFastSearchQuery("");
    setShowAutoSuggest(false);
    setActiveSearchIndex(-1);
  };

  const handleQuickAdd = () => {
    const availableProduct = matchingCatalog.find(
      (product) => product.quantity - getCartQuantity(product.id) > 0,
    );
    if (availableProduct) {
      handleAddItemToCart(availableProduct);
    } else {
      showToast("No matching product is currently in stock.", "error");
    }
  };

  const getCartQuantity = (productId: string) =>
    cartItems
      .filter((item) => item.productId === productId)
      .reduce((total, item) => total + item.quantity, 0);

  const handleCompleteSale = async () => {
    if (savingSale) return;
    if (cartItems.length === 0) {
      showToast("Cannot complete sale with an empty cart.", "error");
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
    const normalizedSplitCouponCode = normalizeCouponCode(splitCouponCode);
    const splitCouponAmount = Number(splitAmounts.coupon || 0);
    if (
      paymentMode === "Split" &&
      splitCouponAmount > 0 !== Boolean(normalizedSplitCouponCode)
    ) {
      showToast(
        "Enter both the coupon code and coupon amount, or leave both blank.",
        "error",
      );
      return;
    }
    const paidNow =
      creditPaidNow === null ? finalTotal : Number(creditPaidNow || 0);
    if (
      paymentMode === "Credit" &&
      (!Number.isFinite(paidNow) || paidNow < 0 || paidNow > finalTotal)
    ) {
      showToast(
        "Amount paid now must be between zero and the bill total.",
        "error",
      );
      return;
    }
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
                        notes: `Coupon code: ${normalizedSplitCouponCode}`,
                      },
                    ]
                  : []),
              ].filter((tender) => tender.amount > 0),
            }
          : {}),
        ...(paymentMode === "Credit" && paidNow > 0
          ? { paymentTenders: [{ method: creditPaidMethod, amount: paidNow }] }
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
        setSplitCouponCode("");
        setCouponCode("");
        setCouponPrice("");
        setCouponEnabled(false);
        setUpiRef("");
      }
    } finally {
      setSavingSale(false);
    }
  };

  const handlePrintCurrentReceipt = () => {
    setActiveReceiptToPrint({
      title: "Retail Bill",
      refNumber: billNumber,
      date:
        billDate +
        " " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      party: customerName,
      items: cartItems.map((c) => ({
        ...(isKilogramProduct(products.find((product) => product.id === c.productId))
          ? { qty: Math.round(c.quantity * 1000), unit: "g" }
          : { qty: c.quantity, unit: products.find((product) => product.id === c.productId)?.unit || "" }),
        name: c.name,
        price: c.price,
        total: c.quantity * c.price,
      })),
      subtotal: grossSubtotal,
      billDiscount,
      couponCode: normalizeCouponCode(couponCode) || undefined,
      couponDiscount,
      total: finalTotal,
      mode: paymentMode,
    });
  };

  return (
    <div className="grid w-full grid-cols-1 items-start gap-3 lg:grid-cols-12">
      <div className="flex flex-col gap-3 lg:col-span-8">
        <section className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-sm sm:grid-cols-2">
          <label
            className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant"
            htmlFor="bill-date"
          >
            Bill date
            <input
              id="bill-date"
              type="date"
              className="h-10 rounded-md border border-outline-variant/30 bg-surface-container-low px-3 font-mono text-on-surface"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </label>
          <label
            className="flex flex-col gap-1 text-sm font-medium text-on-surface-variant"
            htmlFor="customer-search"
          >
            {paymentMode === "Credit"
              ? "Customer (required for credit)"
              : "Customer (optional)"}
            <select
              id="customer-search"
              className="h-10 rounded-md border border-outline-variant/30 bg-surface-container-low px-3 text-on-surface"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setCustomerType(e.target.value ? "registered" : "walkin");
              }}
            >
              <option value="">Walk-in / no customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.name}>
                  {customer.name}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* Main POS workspace: add products and review the cart */}
        {/* Fast Product Scanner Toolbar */}
        <section className="bg-surface-container-lowest p-3 rounded-lg shadow-sm border border-outline-variant/20">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">
                  add_shopping_cart
                </span>
                <span>Add Products</span>
              </label>
              <span className="text-xs text-on-surface-variant">
                Search by product name, SKU, or brand
              </span>
            </div>
            <div className="relative">
              <input
                ref={fastInputRef}
                autoComplete="off"
                type="text"
                className="w-full h-10 px-3 bg-surface-container-low rounded-md font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                placeholder="Search product by name, SKU, or brand..."
                value={fastSearchQuery}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showAutoSuggest && matchingCatalog.length > 0}
                aria-controls={
                  showAutoSuggest && matchingCatalog.length > 0
                    ? "sales-product-results"
                    : undefined
                }
                aria-activedescendant={
                  activeSearchIndex >= 0
                    ? `sales-product-option-${activeSearchIndex}`
                    : undefined
                }
                onChange={(e) => {
                  setFastSearchQuery(e.target.value);
                  setShowAutoSuggest(e.target.value.trim().length > 0);
                  setActiveSearchIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" && matchingCatalog.length > 0) {
                    e.preventDefault();
                    setShowAutoSuggest(true);
                    setActiveSearchIndex((current) =>
                      current >= matchingCatalog.length - 1 ? 0 : current + 1,
                    );
                  } else if (
                    e.key === "ArrowUp" &&
                    matchingCatalog.length > 0
                  ) {
                    e.preventDefault();
                    setShowAutoSuggest(true);
                    setActiveSearchIndex((current) =>
                      current <= 0 ? matchingCatalog.length - 1 : current - 1,
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const selected =
                      showAutoSuggest && activeSearchIndex >= 0
                        ? matchingCatalog[activeSearchIndex]
                        : undefined;
                    if (selected) handleAddItemToCart(selected);
                    else handleQuickAdd();
                  } else if (e.key === "Escape") {
                    setShowAutoSuggest(false);
                    setActiveSearchIndex(-1);
                  }
                }}
              />
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-outline">
                <kbd className="font-data-mono-sm text-[10px] bg-surface-container px-1 py-0.5 rounded">
                  Enter ↵
                </kbd>
              </div>
            </div>

            {/* Search results */}
            {showAutoSuggest && matchingCatalog.length > 0 && (
              <div
                id="sales-product-results"
                role="listbox"
                aria-label="Product search results"
                className="overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest"
              >
                {matchingCatalog.map((prod, index) => {
                  const available = Math.max(
                    0,
                    prod.quantity - getCartQuantity(prod.id),
                  );
                  const unavailable = available <= 0;
                  return (
                    <div
                      key={prod.id}
                      id={`sales-product-option-${index}`}
                      role="option"
                      aria-selected={activeSearchIndex === index}
                      aria-disabled={unavailable}
                      onMouseEnter={() => {
                        if (!unavailable) setActiveSearchIndex(index);
                      }}
                      onClick={() => {
                        if (!unavailable) handleAddItemToCart(prod);
                      }}
                      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-outline-variant/20 border-l-4 px-3 py-2.5 last:border-b-0 sm:gap-4 ${unavailable ? "cursor-not-allowed border-l-red-500 bg-red-50 text-red-900 opacity-80" : activeSearchIndex === index ? "cursor-pointer border-l-[#a86600] bg-[#f4ddb0] shadow-[inset_0_0_0_1px_rgba(168,102,0,.14)]" : "cursor-pointer border-l-transparent hover:bg-surface-container-low"}`}
                    >
                      <div className="min-w-0">
                        <div
                          className={`truncate text-sm font-semibold ${unavailable ? "text-red-800" : "text-on-surface"}`}
                        >
                          {prod.name}
                        </div>
                        <div className="flex min-w-0 items-center gap-1 truncate text-xs text-on-surface-variant">
                          {prod.brand && (
                            <span
                              className="inline-flex max-w-[140px] shrink-0 truncate rounded-full bg-[#fff0c7] px-2 py-0.5 font-medium text-[#795400]"
                              title={prod.brand}
                            >
                              {prod.brand}
                            </span>
                          )}
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-surface-container-low px-1.5 py-0.5 font-semibold"
                            aria-label={`Unit: ${prod.unitName || prod.unit || "not set"}`}
                          >
                            <Package size={12} aria-hidden="true" />
                            {prod.unitName || prod.unit || "—"}
                          </span>
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-sm font-semibold text-on-surface">
                        {formatCurrency(prod.sellingPrice)}
                      </span>
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${unavailable ? "bg-red-100 text-red-700" : "bg-tertiary-container/15 text-tertiary"}`}
                      >
                        {unavailable
                          ? "Out of stock"
                          : `In stock (${available}${prod.unit ? ` ${prod.unit}` : ""})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Cart Line Items Table */}
        <section className="bg-surface-container-lowest rounded-lg shadow-sm overflow-hidden border border-outline-variant/20">
          <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-space-sm">
              <span className="font-title-md text-title-md font-semibold text-on-surface">
                Bill Items
              </span>
              <span className="font-data-mono-sm text-data-mono-sm bg-surface-container-high text-primary px-2 py-0.5 rounded-full font-semibold">
                {cartItems.length} items
              </span>
            </div>
            <button
              type="button"
              className="font-label-sm text-label-sm text-error hover:bg-error-container/40 px-2 py-1 rounded transition-colors flex items-center gap-1"
              onClick={() => {
                setCartItems([]);
                showToast("Cart cleared", "info");
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                delete_sweep
              </span>
              <span>Clear cart</span>
            </button>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-2 px-space-md w-10 text-center">#</th>
                  <th className="py-2 px-space-md min-w-[180px]">
                    Product Name
                  </th>
                  <th className="py-2 px-space-sm">Brand</th>
                  <th className="py-2 px-space-sm w-32 text-center">
                    Quantity / unit
                  </th>
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
                        <div className="flex flex-col">
                          <span className="font-title-md text-body-md font-semibold text-on-surface">
                            {item.name}
                          </span>
                          {product?.unit && (
                            <span className="text-xs text-on-surface-variant">
                              {product.unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-space-sm">
                        <span className="rounded bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">
                          {product?.brand || "—"}
                        </span>
                      </td>
                      <td className="py-2 px-space-sm">
                        <div className="flex items-center justify-center gap-1 bg-surface-container-low rounded p-0.5 border border-outline-variant/30">
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-bold text-xs"
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
                          <input
                            type="number"
                            min={minimumInputQuantity}
                            step={gramEntry ? 1 : quantityStep(allowsDecimals)}
                            max={(product?.quantity ?? 0) * quantityScale}
                            aria-label={`Quantity in ${displayUnit}`}
                            className="w-16 text-center font-data-mono-md text-data-mono-md bg-transparent text-on-surface focus:outline-none"
                            value={inputQuantity}
                            onChange={(e) => {
                              const raw = e.target.value;
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
                          <span className="pr-1 text-[10px] font-semibold text-on-surface-variant">{displayUnit}</span>
                          <button
                            type="button"
                            aria-label={`Increase ${item.name} quantity`}
                            title={
                              item.quantity >= (product?.quantity ?? 0)
                                ? "Maximum available stock reached"
                                : "Increase quantity"
                            }
                            className="w-6 h-6 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-bold text-xs"
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
                      <td className="py-2 px-space-sm text-right">
                        <input
                          type="number"
                          step="1"
                          className="w-20 text-right font-data-mono-md text-data-mono-md bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface focus:outline-none focus:bg-surface-container-lowest border border-outline-variant/30"
                          value={item.price}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!/^\d*$/.test(raw)) return;
                            const val = Number(raw) || 0;
                            setCartItems((prev) =>
                              prev.map((it) =>
                                it.id === item.id ? { ...it, price: val } : it,
                              ),
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
                    <td
                      colSpan={7}
                      className="text-center py-8 text-on-surface-variant font-body-sm"
                    >
                      No products added yet. Search above and choose a product
                      to start the sale.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {stockWarning && (
            <p
              role="alert"
              className="mx-space-md mt-2 rounded-md bg-error-container/40 px-3 py-2 text-sm text-error"
            >
              {stockWarning}
            </p>
          )}

          <div className="bg-surface-container-low px-space-md py-2 text-right text-sm text-on-surface-variant border-t border-outline-variant/20">
            Total quantity:{" "}
            <strong className="text-on-surface">{totalUnits}</strong>
          </div>
        </section>
      </div>

      {/* Bill summary and checkout stay at the top of the right column. */}
      <div className="flex flex-col gap-3 lg:col-span-4">
        <section className="bg-surface-container-lowest p-3 rounded-lg shadow-sm flex flex-col gap-3 border border-outline-variant/20">
          <div>
            <span className="font-title-md text-title-md font-semibold text-on-surface block mb-2">
              Sale total and payment
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

          {/* Select how the customer pays */}
          <div>
            <label className="font-label-md text-on-surface block mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-4 gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/20">
              {(["Cash", "Credit", "UPI", "Split"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPaymentMode(mode);
                    if (mode === "Credit") {
                      setCreditPaidNow(null);
                      setCreditPaidMethod("CASH");
                    }
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
                        ? "account_balance"
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
                  {mode.toUpperCase()} amount (₹)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={splitAmounts[mode]}
                    onChange={(event) => {
                      if (/^\d*$/.test(event.target.value))
                        setSplitAmounts((current) => ({
                          ...current,
                          [mode]: event.target.value,
                        }));
                    }}
                    className="mt-1 h-9 w-full rounded border border-outline-variant/30 bg-white px-2 text-right text-on-surface"
                  />
                </label>
              ))}
              <label className="col-span-2 text-xs font-semibold text-on-surface-variant">
                Coupon code
                <input
                  type="text"
                  value={splitCouponCode}
                  onChange={(event) =>
                    setSplitCouponCode(normalizeCouponCode(event.target.value))
                  }
                  maxLength={80}
                  placeholder="Enter coupon code"
                  className="mt-1 h-9 w-full rounded border border-outline-variant/30 bg-white px-2 text-on-surface"
                />
              </label>
              {Number(splitAmounts.credit || 0) > 0 && (
                <p className="col-span-2 text-xs text-on-surface-variant">
                  Select a registered customer above. The Credit amount will be
                  added to their balance.
                </p>
              )}
              <p className="col-span-2 text-xs text-on-surface-variant">
                Entered: {formatCurrency(splitTenderTotal)} /{" "}
                {formatCurrency(finalTotal)}
              </p>
            </div>
          )}

          {/* Payment Details Subpanel */}
          {paymentMode === "Credit" && (
            <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/20">
              {!customerName ? (
                <p
                  role="status"
                  className="rounded-md bg-surface-container-highest px-3 py-2 text-sm text-on-surface-variant"
                >
                  Choose a registered customer in the Customer field above to
                  complete a credit sale.
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  Credit sale for{" "}
                  <strong className="text-on-surface">{customerName}</strong>.
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                  Paid now (₹)
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={
                      creditPaidNow === null
                        ? String(finalTotal)
                        : creditPaidNow
                    }
                    onChange={(e) =>
                      setCreditPaidNow(e.target.value.replace(/\D/g, ""))
                    }
                    className="h-9 rounded border border-outline-variant/30 bg-surface-container-lowest px-2 text-right text-sm text-on-surface"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                  Payment method
                  <select
                    value={creditPaidMethod}
                    onChange={(e) =>
                      setCreditPaidMethod(e.target.value as "CASH" | "UPI")
                    }
                    className="h-9 rounded border border-outline-variant/30 bg-surface-container-lowest px-2 text-sm text-on-surface"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-on-surface-variant">
                {formatCurrency(
                  Math.max(
                    0,
                    finalTotal -
                      (creditPaidNow === null
                        ? finalTotal
                        : Number(creditPaidNow || 0)),
                  ),
                )}{" "}
                will be added to the customer’s credit balance.
              </p>
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
                <span className="material-symbols-outlined text-[16px] text-primary">
                  info
                </span>
                <span>
                  The unpaid balance will be added to this customer’s account.
                </span>
              </div>
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

          {/* Action Buttons */}
          <div className="flex flex-col gap-space-xs pt-1">
            <button
              type="button"
              disabled={savingSale || cartItems.length === 0}
              className="w-full min-h-11 bg-primary-container text-on-primary rounded-lg font-title-md text-title-md font-semibold hover:bg-primary transition-colors flex items-center justify-center gap-space-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCompleteSale}
            >
              <span className="material-symbols-outlined text-[20px]">
                {savingSale ? "hourglass_top" : "check_circle"}
              </span>
              <span>{savingSale ? "Saving sale…" : "Complete sale"}</span>
            </button>

            <div className="grid grid-cols-1 gap-space-xs">
              <button
                type="button"
                className="h-8 px-space-sm bg-surface-container text-on-surface rounded font-label-md text-label-md font-medium hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1"
                onClick={handlePrintCurrentReceipt}
              >
                <span className="material-symbols-outlined text-[16px]">
                  print
                </span>
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
