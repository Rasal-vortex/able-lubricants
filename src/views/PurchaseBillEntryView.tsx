import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { PurchaseLineItem } from "../types";
import { formatCurrency } from "../utils/currency";
import { PaymentMethod } from "../services/api";
import { UnitEditorModal } from "../components/UnitEditorModal";
import { isUnitQuantityInputValid, isUnitQuantityValid, quantityStep } from "../utils/unitQuantity";

const localIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};
const makeNumber = () => `PUR-${Date.now().toString().slice(-7)}`;
const PURCHASE_DRAFT_KEY = "able_lubes_purchase_draft_v1";

interface PurchaseDraft {
  partyName: string;
  billNumber: string;
  invoiceDate: string;
  remarks: string;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  items: PurchaseLineItem[];
  quantityDrafts: Record<string, string>;
  purchaseRateDrafts: Record<string, string>;
  newProductOpen: boolean;
  newProductName: string;
  newProductBrandId: string;
  newProductUnitId: string;
  newProductSellingPrice: string;
  newProductMrp: string;
  newProductPurchaseRate: string;
}

export const PurchaseBillEntryView: React.FC = () => {
  const {
    purchases,
    products,
    brands,
    units,
    createBrand,
    createUnit,
    suppliers,
    addProduct,
    addPurchaseBill,
    showToast,
    authSession,
  } = useApp();
  const [partyName, setPartyName] = useState(suppliers[0]?.name || "");
  const [billNumber, setBillNumber] = useState(makeNumber);
  const [invoiceDate, setInvoiceDate] = useState(localIso);
  const [remarks, setRemarks] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [items, setItems] = useState<PurchaseLineItem[]>([
    {
      id: "line-1",
      productId: "",
      name: "",
      unit: "",
      quantity: 1,
      sellingPrice: 0,
      purchaseRate: 0,
      totalAmount: 0,
    },
  ]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [purchaseRateDrafts, setPurchaseRateDrafts] = useState<Record<string, string>>({});
  const [recentSearch, setRecentSearch] = useState("");
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductSaving, setNewProductSaving] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrandId, setNewProductBrandId] = useState("");
  const [newProductUnitId, setNewProductUnitId] = useState("");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState("");
  const [newProductMrp, setNewProductMrp] = useState("");
  const [newProductPurchaseRate, setNewProductPurchaseRate] = useState("");
  const [hydratedDraftKey, setHydratedDraftKey] = useState<string | null>(null);
  const skipDraftSaveRef = useRef(false);
  const catalogFieldRefs = useRef<Array<HTMLInputElement | HTMLSelectElement | null>>([]);
  const draftKey = authSession ? `${PURCHASE_DRAFT_KEY}:${authSession.user.id}` : null;
  const updateDecimalPrice = (value: string, setValue: React.Dispatch<React.SetStateAction<string>>) => {
    if (/^\d*\.?\d{0,2}$/.test(value)) setValue(value);
  };
  const blockInvalidPricePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (!/^\d*\.?\d{0,2}$/.test(event.clipboardData.getData("text").trim())) event.preventDefault();
  };
  const handleCatalogFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    const fieldIndex = Number(event.currentTarget.dataset.catalogField);
    if (!Number.isInteger(fieldIndex)) return;
    const isTextInput = event.currentTarget instanceof HTMLInputElement;
    const destinations: Record<string, number | undefined> = {
      "0:ArrowDown": 1,
      "1:ArrowUp": 0, "1:ArrowRight": 2,
      "2:ArrowLeft": 1, "2:ArrowUp": 0,
      "3:ArrowUp": 1, "3:ArrowRight": 4, "3:ArrowDown": 5,
      "4:ArrowLeft": 3, "4:ArrowUp": 2, "4:ArrowDown": 5,
      "5:ArrowUp": 3,
    };
    if (isTextInput && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const input = event.currentTarget as HTMLInputElement;
      const atBoundary = input.selectionStart === input.selectionEnd &&
        (event.key === "ArrowLeft" ? input.selectionStart === 0 : input.selectionEnd === input.value.length);
      if (!atBoundary) return;
    } else if (!isTextInput && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      return;
    }
    const nextIndex = destinations[`${fieldIndex}:${event.key}`];
    if (nextIndex === undefined) return;
    event.preventDefault();
    catalogFieldRefs.current[nextIndex]?.focus();
  };
  const [catalogModal, setCatalogModal] = useState<"brand" | null>(null);
  const [catalogName, setCatalogName] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [unitEditorOpen, setUnitEditorOpen] = useState(false);
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.purchaseRate,
    0,
  );
  const totalAmount = subtotal;
  const paid = Math.min(totalAmount, Math.max(0, Number(amountPaid) || 0));

  useEffect(() => {
    if (!draftKey) {
      setHydratedDraftKey(null);
      return;
    }
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft = JSON.parse(stored) as Partial<PurchaseDraft>;
        if (typeof draft.partyName === "string") setPartyName(draft.partyName);
        if (typeof draft.billNumber === "string") setBillNumber(draft.billNumber);
        if (typeof draft.invoiceDate === "string") setInvoiceDate(draft.invoiceDate);
        if (typeof draft.remarks === "string") setRemarks(draft.remarks);
        if (typeof draft.amountPaid === "string") setAmountPaid(draft.amountPaid);
        if (["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"].includes(draft.paymentMethod || "")) setPaymentMethod(draft.paymentMethod as PaymentMethod);
        if (Array.isArray(draft.items) && draft.items.length) setItems(draft.items);
        if (draft.quantityDrafts && typeof draft.quantityDrafts === "object") setQuantityDrafts(draft.quantityDrafts);
        if (draft.purchaseRateDrafts && typeof draft.purchaseRateDrafts === "object") setPurchaseRateDrafts(draft.purchaseRateDrafts);
        setNewProductOpen(Boolean(draft.newProductOpen));
        if (typeof draft.newProductName === "string") setNewProductName(draft.newProductName);
        if (typeof draft.newProductBrandId === "string") setNewProductBrandId(draft.newProductBrandId);
        if (typeof draft.newProductUnitId === "string") setNewProductUnitId(draft.newProductUnitId);
        if (typeof draft.newProductSellingPrice === "string") setNewProductSellingPrice(draft.newProductSellingPrice);
        if (typeof draft.newProductMrp === "string") setNewProductMrp(draft.newProductMrp);
        if (typeof draft.newProductPurchaseRate === "string") setNewProductPurchaseRate(draft.newProductPurchaseRate);
      }
    } catch {
      try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    }
    setHydratedDraftKey(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || hydratedDraftKey !== draftKey) return;
    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false;
      return;
    }
    const draft: PurchaseDraft = { partyName, billNumber, invoiceDate, remarks, amountPaid, paymentMethod, items, quantityDrafts, purchaseRateDrafts, newProductOpen, newProductName, newProductBrandId, newProductUnitId, newProductSellingPrice, newProductMrp, newProductPurchaseRate };
    try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* Keep the form usable if browser storage is unavailable. */ }
  }, [draftKey, hydratedDraftKey, partyName, billNumber, invoiceDate, remarks, amountPaid, paymentMethod, items, quantityDrafts, purchaseRateDrafts, newProductOpen, newProductName, newProductBrandId, newProductUnitId, newProductSellingPrice, newProductMrp, newProductPurchaseRate]);
  const updateProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    setQuantityDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setPurchaseRateDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              productId,
              name: product?.name || "",
              unit: product?.unit || "",
              sellingPrice: product?.sellingPrice || 0,
              purchaseRate: product?.purchaseRate || 0,
              totalAmount: (product?.purchaseRate || 0) * item.quantity,
            }
          : item,
      ),
    );
  };
  const updateItem = (
    id: string,
    field: "quantity" | "purchaseRate",
    value: number,
  ) =>
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
              totalAmount:
                (field === "quantity" ? value : item.quantity) *
                (field === "purchaseRate" ? value : item.purchaseRate),
            }
          : item,
      ),
    );
  const addLine = () =>
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        productId: "",
        name: "",
        unit: "",
        quantity: 1,
        sellingPrice: 0,
        purchaseRate: 0,
        totalAmount: 0,
      },
    ]);
  const createProductFromPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    const sellingPrice = Number(newProductSellingPrice);
    const mrp = Number(newProductMrp);
    const purchaseRate = Number(newProductPurchaseRate);
    if (!newProductName.trim() || !newProductBrandId || !newProductUnitId ||
      !Number.isFinite(sellingPrice) || sellingPrice < 0 ||
      !Number.isFinite(mrp) || mrp < 0 ||
      !Number.isFinite(purchaseRate) || purchaseRate < 0) {
      showToast("Enter the product name, brand, unit, and valid non-negative prices.", "error");
      return;
    }
    setNewProductSaving(true);
    try {
      const product = await addProduct({
        name: newProductName.trim(),
        brandId: newProductBrandId,
        unitId: newProductUnitId,
        purchaseRate,
        sellingPrice,
        mrp,
        qty: 0,
      });
      const emptyLine = items.find((item) => !item.productId);
      if (emptyLine) {
        setItems((previous) => previous.map((item) => item.id === emptyLine.id ? {
          ...item,
          productId: product.id,
          name: product.name,
          unit: product.unit,
          sellingPrice: product.sellingPrice,
          purchaseRate,
          totalAmount: purchaseRate * item.quantity,
        } : item));
      } else {
        setItems((previous) => [...previous, {
          id: `line-${Date.now()}`,
          productId: product.id,
          name: product.name,
          unit: product.unit,
          quantity: 1,
          sellingPrice: product.sellingPrice,
          purchaseRate,
          totalAmount: purchaseRate,
        }]);
      }
      setNewProductOpen(false);
      setNewProductName("");
      setNewProductBrandId("");
      setNewProductUnitId("");
      setNewProductSellingPrice("");
      setNewProductMrp("");
      setNewProductPurchaseRate("");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to add the product.", "error");
    } finally {
      setNewProductSaving(false);
    }
  };
  const openCatalogModal = (kind: "brand" | "unit") => {
    if (kind === "unit") {
      setUnitEditorOpen(true);
      return;
    }
    setCatalogModal("brand");
    setCatalogName("");
  };
  const saveCatalogOption = async () => {
    const name = catalogName.trim();
    if (!name) {
      showToast("Enter a brand name.", "error");
      return;
    }
    setCatalogSaving(true);
    try {
      if (catalogModal === "brand") {
        const brand = await createBrand(name);
        setNewProductBrandId(brand.id);
      }
      setCatalogModal(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Unable to add ${catalogModal || "option"}.`, "error");
    } finally {
      setCatalogSaving(false);
    }
  };
  const saveUnit = async (payload: { name: string; symbol: string | null; allowsDecimals: boolean }) => {
    const unit = await createUnit(payload.name, payload.symbol, payload.allowsDecimals);
    setNewProductUnitId(unit.id);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!partyName) {
      showToast("Add a supplier before recording a purchase.", "error");
      return;
    }
    if (amountPaid.trim() === "") {
      showToast("Enter the amount paid now. Enter 0 only if this purchase is fully unpaid.", "error");
      return;
    }
    const invalidQuantityDraft = items.some((item) => {
      const draft = quantityDrafts[item.id];
      const allowsDecimals = products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false;
      return draft !== undefined && (!draft || !isUnitQuantityInputValid(draft, allowsDecimals) || Number(draft) <= 0);
    });
    if (invalidQuantityDraft) {
      showToast("Review purchase quantities; use whole numbers for package units and up to 3 decimals for measured units.", "error");
      return;
    }
    const invalidPurchaseRateDraft = items.some((item) => {
      const draft = purchaseRateDrafts[item.id];
      return draft !== undefined && draft !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(draft) || !Number.isFinite(Number(draft)));
    });
    if (invalidPurchaseRateDraft || (amountPaid !== "" && (!/^\d*(?:\.\d{1,2})?$/.test(amountPaid) || Number(amountPaid) > totalAmount))) {
      showToast("Enter valid amounts using digits and up to two decimal places.", "error");
      return;
    }
    if (
      !billNumber.trim() ||
      items.some(
        (item) =>
          !item.productId || item.quantity <= 0 || item.purchaseRate < 0 ||
          !isUnitQuantityValid(item.quantity, products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false),
      )
    ) {
      showToast(
        "Choose a catalog product and enter a valid quantity and rate for each line.",
        "error",
      );
      return;
    }
    setSaving(true);
    try {
      const saved = await addPurchaseBill(
        {
          invoiceNumber: billNumber.trim(),
          partyName,
          invoiceDate,
          items,
          subtotal,
          taxShipping: 0,
          totalAmount,
          amountPaid: paid,
          outstandingBalance: totalAmount - paid,
          remarks: remarks.trim(),
        },
        paymentMethod,
      );
      if (!saved) return;
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* Purchase is saved even if draft cleanup fails. */ }
      }
      skipDraftSaveRef.current = true;
      setBillNumber(makeNumber());
      setInvoiceDate(localIso());
      setRemarks("");
      setAmountPaid("");
      setPaymentMethod("CASH");
      setQuantityDrafts({});
      setPurchaseRateDrafts({});
      setItems([
        {
          id: `line-${Date.now()}`,
          productId: "",
          name: "",
          unit: "",
          quantity: 1,
          sellingPrice: 0,
          purchaseRate: 0,
          totalAmount: 0,
        },
      ]);
    } finally {
      setSaving(false);
    }
  };
  const searchTerm = recentSearch.trim().toLowerCase();
  const filtered = purchases.filter(
    (p) =>
      !searchTerm ||
      `${p.partyName} ${p.items.map((item) => item.name).join(" ")} ${p.invoiceNumber}`
        .toLowerCase()
        .includes(searchTerm),
  );
  const clearPurchaseData = () => {
    if (!window.confirm("Clear the saved purchase draft and reset this purchase form? Other app data and your sign-in will stay unchanged.")) return;
    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch { /* Keep the form usable if storage is unavailable. */ }
    }
    setPartyName(suppliers[0]?.name || "");
    setBillNumber(makeNumber());
    setInvoiceDate(localIso());
    setRemarks("");
    setAmountPaid("");
    setPaymentMethod("CASH");
    setItems([{ id: `line-${Date.now()}`, productId: "", name: "", unit: "", quantity: 1, sellingPrice: 0, purchaseRate: 0, totalAmount: 0 }]);
    setQuantityDrafts({});
    setPurchaseRateDrafts({});
    setNewProductOpen(false);
    setNewProductName("");
    setNewProductBrandId("");
    setNewProductUnitId("");
    setNewProductSellingPrice("");
    setNewProductMrp("");
    setNewProductPurchaseRate("");
  };

  return (
    <div className="daily-register-page w-full">
      <div className="daily-register-screen flex w-full flex-col gap-4">
      <nav
        className="flex flex-wrap items-center justify-between gap-3"
        aria-label="Purchase views"
      >
        <div role="tablist" aria-label="Purchase views" className="inline-flex max-w-full items-center overflow-x-auto rounded-full border border-[#e9e3d9] bg-white p-1 shadow-[0_3px_12px_rgba(37,27,12,.08)]">
          {([
            { id: "new", label: "New Purchase", icon: "add" },
            { id: "history", label: "Purchase History", icon: "format_list_bulleted" },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${activeTab === id ? "text-[#493819]" : "text-[#6b665c] hover:text-[#272727]"}`}
            >
              {activeTab === id && <motion.span layoutId="purchase-tab-indicator" className="absolute inset-0 rounded-full bg-[#fff1c9] shadow-sm" transition={{ duration: 0.24, ease: "easeOut" }} aria-hidden="true" />}
              <span className="material-symbols-outlined relative z-10 text-[18px]">{icon}</span>
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {activeTab === "history" && (
          <input
            value={recentSearch}
            onChange={(e) => setRecentSearch(e.target.value)}
            placeholder="Search supplier, product or invoice"
            aria-label="Search purchase history by supplier, product, or invoice"
            className="h-10 w-full max-w-sm rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-sm text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white"
          />
        )}
        {activeTab === "new" && <button type="button" onClick={clearPurchaseData} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50" title="Clear this purchase form and its saved draft">
          <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          Clear purchase
        </button>}
        </div>
      </nav>
      {activeTab === "new" ? (
        <form
          onSubmit={save}
          className="flex flex-col gap-3"
        >
          <section className="rounded-2xl border border-[#e9e3d9] bg-white p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)] md:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#272727]"><span className="flex h-9 w-9 items-center justify-center text-[#9c6a00]"><span className="material-symbols-outlined">description</span></span>Purchase details</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">
                <span>Supplier <span className="text-red-600">*</span></span>
                <select required value={partyName} onChange={(e) => setPartyName(e.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]">
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Supplier invoice number
                <input required value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Invoice date
                <input required type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-11 rounded-lg border border-[#ead8ad] bg-[#fff7e7] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#e9e3d9] bg-white shadow-[0_3px_12px_rgba(37,27,12,.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
              <h2 className="flex h-9 items-center gap-2 text-lg font-bold text-[#272727]"><span className="flex w-9 items-center justify-center text-[#9c6a00]"><span className="material-symbols-outlined">inventory_2</span></span>Products received</h2>
              <button type="button" onClick={() => setNewProductOpen(true)} className="flex h-10 items-center gap-2 rounded-lg bg-[#ffe4a0] px-4 font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82]">
                <span className="material-symbols-outlined">add</span>New product
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead><tr className="bg-[#f6f5f2] text-xs font-bold text-[#6d685f]">{["#", "Product", "Qty", "Unit", "Purchase rate (₹)", "Line total (₹)", "Action"].map((h) => <th key={h} className="border-y border-r border-[#e9e3d9] px-3 py-3 text-center last:border-r-0">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                  {items.map((item, index) => (
                    <tr key={item.id} className="transition hover:bg-[#fffdf8]">
                      <td className="w-12 border-r border-[#efede8] px-3 py-3 text-center font-semibold text-[#77736d]">{index + 1}</td>
                      <td className="min-w-64 border-r border-[#efede8] px-3 py-3">
                        <select required value={item.productId || ""} onChange={(e) => updateProduct(item.id, e.target.value)} className="h-11 w-full rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]">
                          <option value="">Select product</option>
                          {products.filter((p) => p.status === "Active").map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}{p.unit ? ` · ${p.unit}` : ""}</option>)}
                        </select>
                      </td>
                      <td className="border-r border-[#efede8] px-3 py-3">
                        {(() => {
                          const allowsDecimals = products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false;
                          return <input type="number" min={allowsDecimals ? "0.001" : "1"} step={quantityStep(allowsDecimals)} value={quantityDrafts[item.id] ?? String(item.quantity)} onChange={(event) => { const raw = event.target.value; setQuantityDrafts((previous) => ({ ...previous, [item.id]: raw })); if (!raw || !isUnitQuantityInputValid(raw, allowsDecimals)) return; const value = Number(raw); if (value > 0) updateItem(item.id, "quantity", value); }} onBlur={() => { const raw = quantityDrafts[item.id]; if (raw === undefined) return; const value = Number(raw); if (raw && isUnitQuantityInputValid(raw, allowsDecimals) && value > 0) updateItem(item.id, "quantity", value); setQuantityDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; }); }} className="h-11 w-24 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" />;
                        })()}
                      </td>
                      <td className="border-r border-[#efede8] px-3 py-3 text-center text-[#68645e]">{item.unit || "—"}</td>
                      <td className="border-r border-[#efede8] px-3 py-3"><input type="text" inputMode="decimal" value={purchaseRateDrafts[item.id] ?? (item.purchaseRate ? String(item.purchaseRate) : "")} placeholder="0" onPaste={blockInvalidPricePaste} onChange={(event) => { const raw = event.target.value; if (!/^\d*\.?\d{0,2}$/.test(raw)) return; setPurchaseRateDrafts((previous) => ({ ...previous, [item.id]: raw })); updateItem(item.id, "purchaseRate", Number(raw) || 0); }} onBlur={() => setPurchaseRateDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; })} className="h-11 w-36 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" /></td>
                      <td className="border-r border-[#efede8] px-3 py-3 text-center font-semibold text-[#272727]">{formatCurrency(item.quantity * item.purchaseRate)}</td>
                      <td className="px-3 py-3 text-center"><button type="button" aria-label="Remove product" onClick={() => items.length > 1 ? setItems((prev) => prev.filter((row) => row.id !== item.id)) : showToast("A purchase needs at least one product line.", "error")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 material-symbols-outlined text-error transition hover:bg-red-100">delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#eee8df] px-4 py-3 md:px-5">
              <button type="button" onClick={addLine} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e9e3d9] bg-white px-4 text-sm font-semibold text-[#514a3d] shadow-sm transition hover:bg-[#faf8f3]"><span className="material-symbols-outlined">add</span>Add another line</button>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
            <section className="rounded-2xl border border-[#e9e3d9] bg-white p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)] md:p-5">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#272727]"><span className="flex h-9 w-9 items-center justify-center text-[#9c6a00]"><span className="material-symbols-outlined">payments</span></span>Payment</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Amount paid now
                  <input type="text" inputMode="decimal" value={amountPaid} placeholder="Enter amount (0 if unpaid)" required aria-required="true" onPaste={blockInvalidPricePaste} onChange={(event) => updateDecimalPrice(event.target.value, setAmountPaid)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Payment method
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option></select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d] md:col-span-2">Notes (optional)
                  <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" placeholder="Supplier note" />
                </label>
              </div>
            </section>

            <section className="flex flex-col rounded-2xl border border-[#f0dfb4] bg-[#fff9ec] p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)] md:p-5">
              <h2 className="mb-4 flex h-9 items-center gap-2 text-lg font-bold text-[#272727]"><span className="flex w-9 items-center justify-center text-[#9c6a00]"><span className="material-symbols-outlined">receipt_long</span></span>Summary</h2>
              <div className="flex justify-between py-1 text-sm text-[#514a3d]"><span>Invoice total</span><strong className="text-[#272727]">{formatCurrency(totalAmount)}</strong></div>
              <div className="flex justify-between py-1 text-sm text-[#514a3d]"><span>Amount paid</span><strong className="text-[#272727]">{formatCurrency(paid)}</strong></div>
              <div className="mt-2 flex justify-between border-t border-[#eadfc4] py-3 text-base font-bold"><span className="text-[#9c6a00]">Balance due</span><strong className="text-[#9c6a00]">{formatCurrency(Math.max(0, totalAmount - paid))}</strong></div>
              <button type="submit" disabled={saving || amountPaid.trim() === ""} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ffe078] px-5 font-bold text-[#332711] shadow-sm transition hover:bg-[#ffd64d] focus:outline-none focus:ring-2 focus:ring-[#e8c64e] disabled:cursor-not-allowed disabled:opacity-60"><span className="material-symbols-outlined">save</span>{saving ? "Saving purchase…" : "Save purchase"}</button>
            </section>
          </div>
        </form>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#e9e3d9] bg-white shadow-[0_3px_12px_rgba(37,27,12,.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="h-11 bg-[#f6f5f2] text-xs font-bold uppercase tracking-wide text-[#6d685f]">
                  {[
                    "Date",
                    "Supplier invoice",
                    "Supplier",
                    "Items",
                    "Total",
                    "Paid",
                    "Balance",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-[#68645e]">
                      {p.invoiceDate}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#a86600]">
                      {p.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      {p.partyName}
                    </td>
                    <td className="px-4 py-3">
                      {p.items.map((i, index) => <React.Fragment key={`${i.name}-${index}`}>{index > 0 ? ", " : ""}{i.name} × {i.quantity}</React.Fragment>)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(p.amountPaid || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(p.outstandingBalance || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {p.status || "Recorded"}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-[#77736d]"
                    >
                      No purchases found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {newProductOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !newProductSaving) setNewProductOpen(false); }}>
          <form onSubmit={createProductFromPurchase} className="w-full max-w-lg rounded-2xl border border-[#e9e3d9] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#272727]">Add product to catalog</h2>
            <p className="mt-1 text-sm text-[#77736d]">The product starts with zero stock. This purchase will add the received quantity.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d] sm:col-span-2">Product name
                <input ref={(node) => { catalogFieldRefs.current[0] = node; }} data-catalog-field="0" onKeyDown={handleCatalogFieldKeyDown} autoFocus required value={newProductName} onChange={(event) => setNewProductName(event.target.value)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Product name" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Brand
                <select ref={(node) => { catalogFieldRefs.current[1] = node; }} data-catalog-field="1" onKeyDown={handleCatalogFieldKeyDown} required value={newProductBrandId} onChange={(event) => setNewProductBrandId(event.target.value)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white">
                  <option value="">Select brand</option>
                  {brands.filter((brand) => brand.active !== false).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
                <button type="button" onClick={() => openCatalogModal("brand")} className="self-start text-xs font-semibold text-[#9c6a00] hover:underline">+ Add brand</button>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Unit
                <select ref={(node) => { catalogFieldRefs.current[2] = node; }} data-catalog-field="2" onKeyDown={handleCatalogFieldKeyDown} required value={newProductUnitId} onChange={(event) => setNewProductUnitId(event.target.value)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white">
                  <option value="">Select unit</option>
                  {units.filter((unit) => unit.active !== false).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ""}</option>)}
                </select>
                <button type="button" onClick={() => openCatalogModal("unit")} className="self-start text-xs font-semibold text-[#9c6a00] hover:underline">+ Add unit</button>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Selling price (₹)
                <input ref={(node) => { catalogFieldRefs.current[3] = node; }} data-catalog-field="3" onKeyDown={handleCatalogFieldKeyDown} required type="text" inputMode="decimal" value={newProductSellingPrice} onPaste={blockInvalidPricePaste} onChange={(event) => updateDecimalPrice(event.target.value, setNewProductSellingPrice)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="0.00" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">MRP (₹)
                <input ref={(node) => { catalogFieldRefs.current[4] = node; }} data-catalog-field="4" onKeyDown={handleCatalogFieldKeyDown} required type="text" inputMode="decimal" value={newProductMrp} onPaste={blockInvalidPricePaste} onChange={(event) => updateDecimalPrice(event.target.value, setNewProductMrp)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="0.00" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d] sm:col-span-2">Purchase rate for this bill (₹)
                <input ref={(node) => { catalogFieldRefs.current[5] = node; }} data-catalog-field="5" onKeyDown={handleCatalogFieldKeyDown} required type="text" inputMode="decimal" value={newProductPurchaseRate} onPaste={blockInvalidPricePaste} onChange={(event) => updateDecimalPrice(event.target.value, setNewProductPurchaseRate)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="0.00" />
              </label>
            </div>
            {(!brands.length || !units.length) && <p className="mt-3 text-sm text-[#9c6a00]">Add a brand and unit above to continue.</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={newProductSaving} onClick={() => setNewProductOpen(false)} className="h-10 rounded-lg border border-[#e9e3d9] px-4 text-sm font-medium text-[#555] hover:bg-[#faf8f3] disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={newProductSaving || !brands.length || !units.length} className="h-10 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm transition hover:bg-[#ffdc82] disabled:opacity-50">{newProductSaving ? "Saving…" : "Create and add to purchase"}</button>
            </div>
          </form>
        </div>
      )}
      {catalogModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !catalogSaving) setCatalogModal(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="purchase-catalog-title" className="w-full max-w-sm rounded-2xl border border-[#e9e3d9] bg-white p-5 shadow-2xl">
            <h3 id="purchase-catalog-title" className="text-lg font-bold text-[#272727]">Add brand</h3>
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Brand name
              <input autoFocus value={catalogName} onChange={(event) => setCatalogName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveCatalogOption(); } }} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Brand name" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={catalogSaving} onClick={() => setCatalogModal(null)} className="h-9 rounded-lg border border-[#e9e3d9] px-4 text-sm font-medium text-[#555] hover:bg-[#faf8f3]">Cancel</button>
              <button type="button" disabled={catalogSaving} onClick={() => void saveCatalogOption()} className="h-9 rounded-lg bg-[#ffe4a0] px-4 text-sm font-semibold text-[#493819] shadow-sm hover:bg-[#ffdc82] disabled:opacity-60">{catalogSaving ? "Saving…" : "Save brand"}</button>
            </div>
          </section>
        </div>
      )}
      {unitEditorOpen && <UnitEditorModal units={units} onSave={saveUnit} onClose={() => setUnitEditorOpen(false)} />}
      </div>
    </div>
  );
};
