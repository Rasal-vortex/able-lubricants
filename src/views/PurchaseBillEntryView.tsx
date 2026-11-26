import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useApp } from "../context/AppContext";
import { PurchaseLineItem } from "../types";
import { formatCurrency } from "../utils/currency";
import { getSupplierLedgerReport, PaymentMethod } from "../services/api";
import { UnitEditorModal } from "../components/UnitEditorModal";
import { NumericTextInput } from "../components/ui/NumericTextInput";
import { isUnitQuantityInputValid, isUnitQuantityValid } from "../utils/unitQuantity";
import { DEFAULT_PAGE_SIZE, getPageRecords, getPaginationRange, PaginationControls } from "../components/PaginationControls";

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
    authSession,
  } = useApp();
  const [partyName, setPartyName] = useState(suppliers[0]?.name || "");
  const [billNumber, setBillNumber] = useState(makeNumber);
  const [invoiceDate, setInvoiceDate] = useState(localIso);
  const [remarks, setRemarks] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [supplierCreditInfo, setSupplierCreditInfo] = useState<{ supplierId: string; available: number; existingOutstanding: number } | null>(null);
  const [supplierCreditLoading, setSupplierCreditLoading] = useState(false);
  const [supplierCreditError, setSupplierCreditError] = useState("");
  const [supplierCreditRefresh, setSupplierCreditRefresh] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [saving, setSaving] = useState(false);
  const purchaseRequestKey = useRef(crypto.randomUUID());
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [historyPage, setHistoryPage] = useState(1);
  const [items, setItems] = useState<PurchaseLineItem[]>([
    {
      id: "line-1",
      productId: "",
      name: "",
      unit: "",
      quantity: 1,
      sellingPrice: 0,
      purchaseRate: 0,
      mrp: null,
      totalAmount: 0,
    },
  ]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [purchaseRateDrafts, setPurchaseRateDrafts] = useState<Record<string, string>>({});
  const [sellingRateDrafts, setSellingRateDrafts] = useState<Record<string, string>>({});
  const [mrpDrafts, setMrpDrafts] = useState<Record<string, string>>({});
  const [recentSearch, setRecentSearch] = useState("");
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductSaving, setNewProductSaving] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrandId, setNewProductBrandId] = useState("");
  const [newProductUnitId, setNewProductUnitId] = useState("");
  const [newProductSellingPrice, setNewProductSellingPrice] = useState("");
  const [newProductMrp, setNewProductMrp] = useState("");
  const [newProductPurchaseRate, setNewProductPurchaseRate] = useState("");
  const catalogFieldRefs = useRef<Array<HTMLInputElement | HTMLSelectElement | null>>([]);
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
  const selectedSupplier = suppliers.find((supplier) => supplier.name === partyName);
  useEffect(() => {
    if (!authSession || !selectedSupplier) {
      setSupplierCreditInfo(null);
      setSupplierCreditLoading(false);
      setSupplierCreditError("");
      return;
    }
    let active = true;
    setSupplierCreditInfo(null);
    setSupplierCreditLoading(true);
    setSupplierCreditError("");
    getSupplierLedgerReport(authSession.token, selectedSupplier.id)
      .then((ledger) => {
        if (active) setSupplierCreditInfo({
          supplierId: selectedSupplier.id,
          available: Number(ledger.totals?.supplierCredit) || 0,
          existingOutstanding: (ledger.purchases || []).filter((purchase: { status?: string }) => purchase.status === "POSTED")
            .reduce((sum: number, purchase: { outstanding?: string | number }) => sum + (Number(purchase.outstanding) || 0), 0),
        });
      })
      .catch((error) => {
        if (active) setSupplierCreditError(error instanceof Error ? error.message : "Could not check supplier credit.");
      })
      .finally(() => { if (active) setSupplierCreditLoading(false); });
    return () => { active = false; };
  }, [authSession, selectedSupplier?.id, supplierCreditRefresh]);
  const [unitEditorOpen, setUnitEditorOpen] = useState(false);
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.purchaseRate,
    0,
  );
  const totalAmount = subtotal;
  const supplierCreditReady = Boolean(selectedSupplier && supplierCreditInfo?.supplierId === selectedSupplier.id && !supplierCreditLoading && !supplierCreditError);
  const supplierCreditAvailable = supplierCreditReady ? supplierCreditInfo?.available || 0 : 0;
  const supplierCreditRemainingAfterOlderBills = Math.max(0, supplierCreditAvailable - (supplierCreditInfo?.existingOutstanding || 0));
  const supplierCreditApplied = Math.min(totalAmount, supplierCreditRemainingAfterOlderBills);
  const dueAfterSupplierCredit = Math.max(0, totalAmount - supplierCreditApplied);
  const enteredAmountPaid = Number(amountPaid);
  const paymentExceedsTotal = amountPaid !== "" && Number.isFinite(enteredAmountPaid) && enteredAmountPaid > dueAfterSupplierCredit;
  const paid = Math.min(dueAfterSupplierCredit, Math.max(0, Number(amountPaid) || 0));

  const updateProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    setQuantityDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setPurchaseRateDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setSellingRateDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setMrpDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
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
              mrp: product?.mrp > 0 ? product.mrp : null,
              totalAmount: (product?.purchaseRate || 0) * item.quantity,
            }
          : item,
      ),
    );
  };
  const updateItem = (
    id: string,
    field: "quantity" | "purchaseRate" | "sellingPrice" | "mrp",
    value: number | null,
  ) =>
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
              totalAmount:
                (field === "quantity" ? Number(value) : item.quantity) *
                (field === "purchaseRate" ? Number(value) : item.purchaseRate),
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
        mrp: null,
        totalAmount: 0,
      },
    ]);
  const createProductFromPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    const sellingPrice = Number(newProductSellingPrice);
    const mrp = Number(newProductMrp);
    const purchaseRate = Number(newProductPurchaseRate);
    if (!Number.isFinite(purchaseRate) || purchaseRate <= 0) {
      showToast("Purchase rate must be greater than ₹0.00.", "error");
      return;
    }
    if (!newProductName.trim() || !newProductBrandId || !newProductUnitId ||
      !Number.isFinite(sellingPrice) || sellingPrice < 0 ||
      !Number.isFinite(mrp) || mrp < 0) {
      showToast("Enter the product name, brand, unit, and valid prices.", "error");
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
          mrp: product.mrp > 0 ? product.mrp : null,
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
          mrp: product.mrp > 0 ? product.mrp : null,
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
    if (!supplierCreditReady) {
      showToast(supplierCreditError || "Wait for the supplier credit check before saving.", "error");
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
    if (paymentExceedsTotal) {
      showToast(`Amount paid is greater than the remaining bill after supplier credit (${formatCurrency(dueAfterSupplierCredit)}). Reduce it before saving.`, "error");
      return;
    }
    const invalidPurchaseRateDraft = items.some((item) => {
      const draft = purchaseRateDrafts[item.id];
      return draft !== undefined && draft !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(draft) || !Number.isFinite(Number(draft)));
    });
    const invalidSellingRateDraft = items.some((item) => {
      const draft = sellingRateDrafts[item.id];
      return draft !== undefined && (!/^\d+(?:\.\d{1,2})?$/.test(draft) || !Number.isFinite(Number(draft)) || Number(draft) <= 0);
    });
    const invalidMrpDraft = items.some((item) => {
      const draft = mrpDrafts[item.id];
      const productSellingPrice = products.find((product) => product.id === item.productId)?.sellingPrice || 0;
      return draft !== undefined && draft !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(draft) || !Number.isFinite(Number(draft)) || Number(draft) <= Math.max(item.sellingPrice, productSellingPrice));
    });
    if (invalidPurchaseRateDraft || invalidSellingRateDraft || invalidMrpDraft || (amountPaid !== "" && !/^\d*(?:\.\d{1,2})?$/.test(amountPaid))) {
      showToast("Enter valid amounts using digits and up to two decimal places.", "error");
      return;
    }
    if (items.some((item) => item.productId && (!Number.isFinite(item.purchaseRate) || item.purchaseRate <= 0 || !Number.isFinite(item.sellingPrice) || item.sellingPrice <= 0))) {
      showToast("Purchase and selling rates must be greater than ₹0.00 for every product line.", "error");
      return;
    }
    if (items.some((item) => {
      const productSellingPrice = products.find((product) => product.id === item.productId)?.sellingPrice || 0;
      return item.productId && item.mrp != null && (!Number.isFinite(item.mrp) || item.mrp <= Math.max(item.sellingPrice, productSellingPrice));
    })) {
      showToast("MRP must be greater than the batch and configured product selling rates.", "error");
      return;
    }
    if (
      !billNumber.trim() ||
      items.some(
        (item) =>
          !item.productId || item.quantity <= 0 || item.sellingPrice <= 0 ||
          !isUnitQuantityValid(item.quantity, products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false),
      )
    ) {
      showToast(
        "Choose a catalog product and enter a valid quantity and purchase rate greater than ₹0.00 for every line.",
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
          outstandingBalance: Math.max(0, totalAmount - supplierCreditApplied - paid),
          remarks: remarks.trim(),
        },
        paymentMethod,
        purchaseRequestKey.current,
      );
      if (!saved) return;
      purchaseRequestKey.current = crypto.randomUUID();
      setBillNumber(makeNumber());
      setInvoiceDate(localIso());
      setRemarks("");
      setAmountPaid("");
      setPaymentMethod("CASH");
      setQuantityDrafts({});
      setPurchaseRateDrafts({});
      setSellingRateDrafts({});
      setMrpDrafts({});
      setItems([
        {
          id: `line-${Date.now()}`,
          productId: "",
          name: "",
          unit: "",
          quantity: 1,
          sellingPrice: 0,
          purchaseRate: 0,
          mrp: null,
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
  const historyPageCount = Math.max(1, Math.ceil(filtered.length / DEFAULT_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const pagePurchases = getPageRecords(filtered, safeHistoryPage);
  const historyRange = getPaginationRange(filtered.length, safeHistoryPage);
  useEffect(() => { setHistoryPage(1); }, [searchTerm]);
  useEffect(() => { if (historyPage > historyPageCount) setHistoryPage(historyPageCount); }, [historyPage, historyPageCount]);
  const clearPurchaseData = () => {
    if (!window.confirm("Reset the purchase form? Saved purchases will remain unchanged.")) return;
    setPartyName(suppliers[0]?.name || "");
    setBillNumber(makeNumber());
    setInvoiceDate(localIso());
    setRemarks("");
    setAmountPaid("");
    setPaymentMethod("CASH");
    setItems([{ id: `line-${Date.now()}`, productId: "", name: "", unit: "", quantity: 1, sellingPrice: 0, purchaseRate: 0, mrp: null, totalAmount: 0 }]);
    setQuantityDrafts({});
    setPurchaseRateDrafts({});
    setMrpDrafts({});
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
              <table className="w-full min-w-[1100px] table-fixed border-collapse text-left">
                <colgroup><col style={{ width: "4.5%" }} /><col style={{ width: "25%" }} /><col style={{ width: "8.5%" }} /><col style={{ width: "6%" }} /><col style={{ width: "12.5%" }} /><col style={{ width: "13.5%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12.5%" }} /><col style={{ width: "6.5%" }} /></colgroup>
                <thead><tr className="bg-[#f6f5f2] text-xs font-bold text-[#6d685f]">{["#", "Product", "Qty", "Unit", "Selling rate (₹)", "Purchase rate (₹)", "MRP (₹)", "Line total (₹)", "Action"].map((h) => <th key={h} className="border-y border-r border-[#e9e3d9] px-2 py-3 text-center last:border-r-0">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#efede8] text-sm text-[#272727]">
                  {items.map((item, index) => (
                    <tr key={item.id} className="transition hover:bg-[#fffdf8]">
                      <td className="border-r border-[#efede8] px-2 py-3 text-center font-semibold text-[#77736d]">{index + 1}</td>
                      <td className="border-r border-[#efede8] px-2 py-3">
                        <select required value={item.productId || ""} onChange={(e) => updateProduct(item.id, e.target.value)} className="h-11 w-full rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-2 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]">
                          <option value="">Select product</option>
                          {products.filter((p) => p.status === "Active").map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}{p.unit ? ` · ${p.unit}` : ""}</option>)}
                        </select>
                      </td>
                      <td className="border-r border-[#efede8] px-2 py-3">
                        {(() => {
                          const allowsDecimals = products.find((product) => product.id === item.productId)?.unitAllowsDecimals ?? false;
                          return <NumericTextInput maxDecimals={allowsDecimals ? 3 : 0} value={quantityDrafts[item.id] ?? String(item.quantity)} onValueChange={(raw) => { setQuantityDrafts((previous) => ({ ...previous, [item.id]: raw })); if (!raw || !isUnitQuantityInputValid(raw, allowsDecimals)) return; const value = Number(raw); if (value > 0) updateItem(item.id, "quantity", value); }} onBlur={() => { const raw = quantityDrafts[item.id]; if (raw === undefined) return; const value = Number(raw); if (raw && isUnitQuantityInputValid(raw, allowsDecimals) && value > 0) updateItem(item.id, "quantity", value); setQuantityDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; }); }} className="h-11 w-16 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-2 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" />;
                        })()}
                      </td>
                      <td className="border-r border-[#efede8] px-2 py-3 text-center text-[#68645e]">{item.unit || "—"}</td>
                      <td className="border-r border-[#efede8] px-2 py-3"><input type="text" inputMode="decimal" required aria-label="Selling rate for new batch, greater than zero" title="Selling rate must be greater than ₹0.00" value={sellingRateDrafts[item.id] ?? (item.sellingPrice ? String(item.sellingPrice) : "")} placeholder="Required" onPaste={blockInvalidPricePaste} onChange={(event) => { const raw = event.target.value; if (!/^\d*\.?\d{0,2}$/.test(raw)) return; setSellingRateDrafts((previous) => ({ ...previous, [item.id]: raw })); updateItem(item.id, "sellingPrice", Number(raw) || 0); }} onBlur={() => setSellingRateDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; })} className="h-11 w-full max-w-28 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-2 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" /></td>
                      <td className="border-r border-[#efede8] px-2 py-3"><input type="text" inputMode="decimal" required aria-label="Purchase rate for product line, greater than zero" title="Purchase rate must be greater than ₹0.00" value={purchaseRateDrafts[item.id] ?? (item.purchaseRate ? String(item.purchaseRate) : "")} placeholder="Required" onPaste={blockInvalidPricePaste} onChange={(event) => { const raw = event.target.value; if (!/^\d*\.?\d{0,2}$/.test(raw)) return; setPurchaseRateDrafts((previous) => ({ ...previous, [item.id]: raw })); updateItem(item.id, "purchaseRate", Number(raw) || 0); }} onBlur={() => setPurchaseRateDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; })} className="h-11 w-full max-w-28 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-2 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" /></td>
                      <td className="border-r border-[#efede8] px-2 py-3"><input type="text" inputMode="decimal" aria-label="MRP for product batch, greater than selling rate" title="MRP is optional and, when entered, must be greater than the selling rate" value={mrpDrafts[item.id] ?? (item.mrp != null ? String(item.mrp) : "")} placeholder="Optional" onPaste={blockInvalidPricePaste} onChange={(event) => { const raw = event.target.value; if (!/^\d*\.?\d{0,2}$/.test(raw)) return; setMrpDrafts((previous) => ({ ...previous, [item.id]: raw })); updateItem(item.id, "mrp", raw === "" ? null : Number(raw)); }} onBlur={() => setMrpDrafts((previous) => { const next = { ...previous }; delete next[item.id]; return next; })} className="h-11 w-full max-w-24 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-2 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" /></td>
                      <td className="border-r border-[#efede8] px-2 py-3 text-center font-semibold text-[#272727]">{formatCurrency(item.quantity * item.purchaseRate)}</td>
                      <td className="px-2 py-3 text-center"><button type="button" aria-label="Remove product" onClick={() => items.length > 1 ? setItems((prev) => prev.filter((row) => row.id !== item.id)) : showToast("A purchase needs at least one product line.", "error")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 material-symbols-outlined text-error transition hover:bg-red-100">delete</button></td>
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
                  <input type="text" inputMode="decimal" value={amountPaid} placeholder="Leave blank if unpaid" aria-invalid={paymentExceedsTotal} aria-describedby={paymentExceedsTotal ? "purchase-payment-error" : undefined} onPaste={blockInvalidPricePaste} onChange={(event) => updateDecimalPrice(event.target.value, setAmountPaid)} className={`h-11 rounded-lg border bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:bg-white focus:ring-2 ${paymentExceedsTotal ? "border-red-500 focus:border-red-500 focus:ring-red-100" : "border-[#e8e4dd] focus:border-[#c58a00] focus:ring-[#f5e7c3]"}`} />
                  {paymentExceedsTotal && <span id="purchase-payment-error" role="alert" className="text-xs font-medium text-red-600">Amount paid ({formatCurrency(enteredAmountPaid)}) is greater than the amount due after supplier credit ({formatCurrency(dueAfterSupplierCredit)}).</span>}
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d]">Payment method
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option></select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-[#77736d] md:col-span-2">Notes (optional)
                  <input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="h-11 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 text-[#272727] outline-none transition focus:border-[#c58a00] focus:bg-white focus:ring-2 focus:ring-[#f5e7c3]" placeholder="Supplier note" />
                </label>
              </div>
              {supplierCreditLoading && <p className="text-xs text-[#77736d]">Checking supplier credit…</p>}
              {supplierCreditError && <p role="alert" className="text-xs text-red-700">Could not check supplier credit. <button type="button" onClick={() => setSupplierCreditRefresh((value) => value + 1)} className="font-semibold underline">Try again</button></p>}
              {supplierCreditAvailable > 0 && <p className="rounded-lg bg-[#f4f7f2] px-3 py-2 text-xs text-[#4c6b45]">Available supplier credit: <strong>{formatCurrency(supplierCreditAvailable)}</strong>. It is applied to older unpaid purchases first; this invoice is estimated to receive <strong>{formatCurrency(supplierCreditApplied)}</strong>.</p>}
            </section>

            <section className="flex flex-col rounded-2xl border border-[#f0dfb4] bg-[#fff9ec] p-4 shadow-[0_3px_12px_rgba(37,27,12,.06)] md:p-5">
              <h2 className="mb-4 flex h-9 items-center gap-2 text-lg font-bold text-[#272727]"><span className="flex w-9 items-center justify-center text-[#9c6a00]"><span className="material-symbols-outlined">receipt_long</span></span>Summary</h2>
              <div className="flex justify-between py-1 text-sm text-[#514a3d]"><span>Invoice total</span><strong className="text-[#272727]">{formatCurrency(totalAmount)}</strong></div>
              {supplierCreditApplied > 0 && <div className="flex justify-between py-1 text-sm text-[#4c6b45]"><span>Supplier credit applied</span><strong>{formatCurrency(supplierCreditApplied)}</strong></div>}
              <div className="flex justify-between py-1 text-sm text-[#514a3d]"><span>Amount paid</span><strong className="text-[#272727]">{formatCurrency(paid)}</strong></div>
              <div className="mt-2 flex justify-between border-t border-[#eadfc4] py-3 text-base font-bold"><span className="text-[#9c6a00]">Balance due</span><strong className="text-[#9c6a00]">{formatCurrency(Math.max(0, dueAfterSupplierCredit - paid))}</strong></div>
              <button type="submit" disabled={saving || paymentExceedsTotal || !supplierCreditReady} className="mt-auto flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ffe078] px-5 font-bold text-[#332711] shadow-sm transition hover:bg-[#ffd64d] focus:outline-none focus:ring-2 focus:ring-[#e8c64e] disabled:cursor-not-allowed disabled:opacity-60"><span className="material-symbols-outlined">save</span>{saving ? "Saving purchase…" : "Save purchase"}</button>
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
                    "Credit applied",
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
                {pagePurchases.map((p) => (
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
                      {formatCurrency(p.supplierCreditApplied || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(p.outstandingBalance || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'CANCELLED' ? <div className="flex flex-col items-start gap-1"><span className="rounded-full bg-[#ecebe8] px-2.5 py-1 text-xs font-semibold text-[#625f59]">Cancelled</span>{p.cancellation?.refund?.status && <span className="text-xs text-[#77736d]">{p.cancellation.refund.status === 'NO_REFUND_REQUIRED' ? 'No refund required' : p.cancellation.refund.status === 'FULLY_REFUNDED' ? 'Fully refunded' : p.cancellation.refund.status === 'PARTIALLY_REFUNDED' ? `Partially refunded · ${formatCurrency(p.cancellation.refund.settled)}` : `Refund pending · ${formatCurrency(p.cancellation.refund.pending)}`}</span>}</div> : p.status || "Recorded"}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-[#77736d]"
                    >
                      No purchases found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t border-[#efede8] bg-[#f8f7f4] px-4 py-3 text-xs text-[#77736d] sm:flex-row sm:items-center sm:justify-between">
            <span>Showing <strong className="text-[#272727]">{historyRange.start}-{historyRange.end}</strong> of <strong className="text-[#272727]">{filtered.length}</strong> purchases</span>
            <PaginationControls totalRecords={filtered.length} page={safeHistoryPage} onPageChange={setHistoryPage} />
          </footer>
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
                <input ref={(node) => { catalogFieldRefs.current[5] = node; }} data-catalog-field="5" onKeyDown={handleCatalogFieldKeyDown} required type="text" inputMode="decimal" value={newProductPurchaseRate} onPaste={blockInvalidPricePaste} onChange={(event) => updateDecimalPrice(event.target.value, setNewProductPurchaseRate)} className="h-10 rounded-lg border border-[#e8e4dd] bg-[#f8f7f4] px-3 font-normal text-[#272727] outline-none focus:border-[#c58a00] focus:bg-white" placeholder="Required · > 0.00" />
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
