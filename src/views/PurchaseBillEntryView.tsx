import React, { useState } from "react";
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
  const [recentSearch, setRecentSearch] = useState("");
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductSaving, setNewProductSaving] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrandId, setNewProductBrandId] = useState("");
  const [newProductUnitId, setNewProductUnitId] = useState("");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState("");
  const [newProductMrp, setNewProductMrp] = useState("");
  const [newProductPurchaseRate, setNewProductPurchaseRate] = useState("");
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
  const updateProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    setQuantityDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
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
      showToast("Enter the product name, brand, unit, and valid prices.", "error");
      return;
    }
    setNewProductSaving(true);
    try {
      const product = await addProduct({
        name: newProductName.trim(),
        brandId: newProductBrandId,
        unitId: newProductUnitId,
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
    const invalidQuantityDraft = items.some((item) => {
      const draft = quantityDrafts[item.id];
      const allowsDecimals = products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false;
      return draft !== undefined && (!draft || !isUnitQuantityInputValid(draft, allowsDecimals) || Number(draft) <= 0);
    });
    if (invalidQuantityDraft) {
      showToast("Review purchase quantities; use whole numbers for package units and up to 3 decimals for measured units.", "error");
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
      setBillNumber(makeNumber());
      setInvoiceDate(localIso());
      setRemarks("");
      setAmountPaid("");
      setPaymentMethod("CASH");
      setQuantityDrafts({});
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

  return (
    <div className="flex flex-col w-full gap-space-md">
      <nav
        className="flex items-center justify-between gap-space-md border-b border-outline-variant/25 px-space-sm"
        aria-label="Purchase views"
      >
        <div className="flex items-center gap-space-sm">
        <button
          type="button"
          onClick={() => setActiveTab("new")}
          className={`flex items-center gap-2 border-b-2 px-space-md py-3 font-semibold transition-colors ${activeTab === "new" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
        >
          <span className="material-symbols-outlined">add</span>New Purchase
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 border-b-2 px-space-md py-3 font-semibold transition-colors ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
        >
          <span className="material-symbols-outlined">
            format_list_bulleted
          </span>
          Purchase History
        </button>
        </div>
        {activeTab === "history" && (
          <input
            value={recentSearch}
            onChange={(e) => setRecentSearch(e.target.value)}
            placeholder="Search supplier, product or invoice"
            aria-label="Search purchase history by supplier, product, or invoice"
            className="h-10 w-full max-w-sm px-3 rounded-md border border-outline-variant/30 bg-surface-container-lowest text-on-surface"
          />
        )}
      </nav>
      {activeTab === "new" ? (
        <form
          onSubmit={save}
          className="bg-surface-container-lowest rounded-xl border border-blue-100 p-space-lg md:p-space-xl flex flex-col gap-space-lg shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <label className="flex flex-col gap-1.5 text-label-md font-medium text-slate-600">
              <span>Supplier <span className="text-red-600">*</span></span>
              <select
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="h-11 px-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-label-md font-medium text-slate-600">
              Supplier invoice number
              <input
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="h-11 px-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-label-md font-medium text-slate-600">
              Invoice date
              <input
                required
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-11 px-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="font-title-md font-semibold text-slate-900">Products received</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addLine} className="h-10 px-4 rounded-lg border border-blue-200 bg-white text-blue-700 font-semibold flex items-center gap-2 shadow-sm transition hover:bg-blue-50">
                  <span className="material-symbols-outlined">playlist_add</span>Add line
                </button>
                <button type="button" onClick={() => setNewProductOpen(true)} className="h-10 px-4 rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-2 shadow-sm transition hover:bg-blue-700">
                  <span className="material-symbols-outlined">add</span>New product
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 text-label-sm uppercase text-slate-600">
                  {[
                    "Product",
                    "Qty",
                    "Unit",
                    "Purchase rate (₹)",
                    "Line total (₹)",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="border-b border-r border-slate-200 px-space-md py-3 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="min-w-64 border-r border-slate-100 px-space-md py-3">
                      <select
                        required
                        value={item.productId || ""}
                        onChange={(e) => updateProduct(item.id, e.target.value)}
                        className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Select product</option>
                        {products
                          .filter((p) => p.status === "Active")
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.sku ? ` · ${p.sku}` : ""}
                              {p.unit ? ` · ${p.unit}` : ""}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="border-r border-slate-100 px-space-md py-3">
                      {(() => {
                        const allowsDecimals = products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false;
                        return <input
                          type="number"
                          min={allowsDecimals ? "0.001" : "1"}
                          step={quantityStep(allowsDecimals)}
                          value={quantityDrafts[item.id] ?? String(item.quantity)}
                          onChange={(event) => {
                            const raw = event.target.value;
                            setQuantityDrafts((previous) => ({ ...previous, [item.id]: raw }));
                            if (!raw || !isUnitQuantityInputValid(raw, allowsDecimals)) return;
                            const value = Number(raw);
                            if (value > 0) updateItem(item.id, "quantity", value);
                          }}
                          onBlur={() => {
                            const raw = quantityDrafts[item.id];
                            if (raw === undefined) return;
                            const value = Number(raw);
                            if (raw && isUnitQuantityInputValid(raw, allowsDecimals) && value > 0) updateItem(item.id, "quantity", value);
                            setQuantityDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; });
                          }}
                          className="h-11 w-28 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />;
                      })()}
                    </td>
                    <td className="border-r border-slate-100 px-space-md py-3 text-slate-600">
                      <span className="inline-flex min-w-16 justify-center rounded-md bg-slate-100 px-3 py-2">{item.unit || "—"}</span>
                    </td>
                    <td className="border-r border-slate-100 px-space-md py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.purchaseRate || ""}
                        placeholder="0"
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "purchaseRate",
                            Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                        className="h-11 w-44 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                    </td>
                    <td className="border-r border-slate-100 px-space-md py-3 font-semibold text-slate-900">
                      <span className="inline-flex min-w-28 rounded-md bg-slate-50 px-3 py-2">{formatCurrency(item.quantity * item.purchaseRate)}</span>
                    </td>
                    <td className="px-space-md py-3 text-center">
                      <button
                        type="button"
                        aria-label="Remove product"
                        onClick={() =>
                          items.length > 1
                            ? setItems((prev) =>
                                prev.filter((row) => row.id !== item.id),
                              )
                            : showToast(
                                "A purchase needs at least one product line.",
                                "error",
                              )
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-red-50 material-symbols-outlined text-error transition hover:bg-red-100"
                      >
                        delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md items-end">
            <label className="flex flex-col gap-1.5 text-label-md font-medium text-slate-600">
              Notes (optional)
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                placeholder="Supplier note"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-label-md font-medium text-slate-600">
              Amount paid now (₹)
              <input
                type="number"
                min="0"
                max={totalAmount}
                step="0.01"
                value={amountPaid}
                placeholder="0"
                onChange={(e) => setAmountPaid(e.target.value)}
                className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-label-md font-medium text-slate-600">
              Payment method
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </label>
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
              <div className="flex justify-between text-label-md text-slate-600">
                <span>Invoice total</span>
                <strong className="text-slate-900">
                  {formatCurrency(totalAmount)}
                </strong>
              </div>
              <div className="mt-2 flex justify-between text-label-md text-slate-600">
                <span>Balance due</span>
                <strong className="text-blue-700">
                  {formatCurrency(Math.max(0, totalAmount - paid))}
                </strong>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-12 px-7 rounded-lg bg-blue-600 text-white font-semibold shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined">save</span>
              {saving ? "Saving purchase…" : "Save purchase"}
            </button>
          </div>
        </form>
      ) : (
        <section className="bg-surface-container-lowest rounded-lg border border-outline-variant/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low">
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
                      className="px-space-md py-3 text-label-sm uppercase text-on-surface-variant"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="px-space-md py-3 text-on-surface-variant">
                      {p.invoiceDate}
                    </td>
                    <td className="px-space-md py-3 font-mono text-primary">
                      {p.invoiceNumber}
                    </td>
                    <td className="px-space-md py-3 text-on-surface">
                      {p.partyName}
                    </td>
                    <td className="px-space-md py-3 text-on-surface">
                      {p.items.map((i, index) => <React.Fragment key={`${i.name}-${index}`}>{index > 0 ? ", " : ""}{i.name} × {i.quantity}</React.Fragment>)}
                    </td>
                    <td className="px-space-md py-3 text-on-surface">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="px-space-md py-3 text-on-surface">
                      {formatCurrency(p.amountPaid || 0)}
                    </td>
                    <td className="px-space-md py-3 text-on-surface">
                      {formatCurrency(p.outstandingBalance || 0)}
                    </td>
                    <td className="px-space-md py-3 text-on-surface">
                      {p.status || "Recorded"}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-on-surface-variant"
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
          <form onSubmit={createProductFromPurchase} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Add product to catalog</h2>
            <p className="mt-1 text-sm text-slate-600">The product starts with zero stock. This purchase will add the received quantity.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Product name
                <input autoFocus required value={newProductName} onChange={(event) => setNewProductName(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" placeholder="Product name" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Brand
                <select required value={newProductBrandId} onChange={(event) => setNewProductBrandId(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3">
                  <option value="">Select brand</option>
                  {brands.filter((brand) => brand.active !== false).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
                <button type="button" onClick={() => openCatalogModal("brand")} className="self-start text-xs font-semibold text-blue-700 hover:underline">+ Add brand</button>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Unit
                <select required value={newProductUnitId} onChange={(event) => setNewProductUnitId(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3">
                  <option value="">Select unit</option>
                  {units.filter((unit) => unit.active !== false).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ""}</option>)}
                </select>
                <button type="button" onClick={() => openCatalogModal("unit")} className="self-start text-xs font-semibold text-blue-700 hover:underline">+ Add unit</button>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">Selling price (₹)
                <input required type="number" min="0" step="0.01" value={newProductSellingPrice} onChange={(event) => setNewProductSellingPrice(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" placeholder="0.00" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">MRP (₹)
                <input required type="number" min="0" step="0.01" value={newProductMrp} onChange={(event) => setNewProductMrp(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" placeholder="0.00" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">Purchase rate for this bill (₹)
                <input required type="number" min="0" step="0.01" value={newProductPurchaseRate} onChange={(event) => setNewProductPurchaseRate(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3" placeholder="0.00" />
              </label>
            </div>
            {(!brands.length || !units.length) && <p className="mt-3 text-sm text-amber-700">Add a brand and unit above to continue.</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={newProductSaving} onClick={() => setNewProductOpen(false)} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={newProductSaving || !brands.length || !units.length} className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{newProductSaving ? "Saving…" : "Create and add to purchase"}</button>
            </div>
          </form>
        </div>
      )}
      {catalogModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !catalogSaving) setCatalogModal(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="purchase-catalog-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 id="purchase-catalog-title" className="text-lg font-semibold text-slate-900">Add brand</h3>
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-slate-700">Brand name
              <input autoFocus value={catalogName} onChange={(event) => setCatalogName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveCatalogOption(); } }} className="h-10 rounded-md border border-slate-300 px-3" placeholder="Brand name" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={catalogSaving} onClick={() => setCatalogModal(null)} className="h-9 rounded-md border border-slate-300 px-4 text-sm text-slate-700">Cancel</button>
              <button type="button" disabled={catalogSaving} onClick={() => void saveCatalogOption()} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{catalogSaving ? "Saving…" : "Save brand"}</button>
            </div>
          </section>
        </div>
      )}
      {unitEditorOpen && <UnitEditorModal units={units} onSave={saveUnit} onClose={() => setUnitEditorOpen(false)} />}
    </div>
  );
};
