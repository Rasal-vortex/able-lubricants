import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { Product } from "../types";
import { ApiClientError } from "../services/api";
import type { UpdateProductPayload } from "../services/api";
import { formatCurrency } from "../utils/currency";
import { UnitEditorModal } from "../components/UnitEditorModal";
import { NumericTextInput } from "../components/ui/NumericTextInput";
import { isUnitQuantityValid } from "../utils/unitQuantity";
import { DEFAULT_PAGE_SIZE, getPageRecords, getPaginationRange, PaginationControls } from "../components/PaginationControls";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

type BatchDraft = {
  key: string;
  id?: string;
  quantity: string;
  purchaseRate: string;
  sellingRate: string;
  mrp: string;
  isNew: boolean;
  original?: {
    quantity: string;
    sellingRate: string;
    mrp: string;
  };
};

type PendingProductUpdate = {
  idempotencyKey: string;
  payload: UpdateProductPayload;
};

const pendingProductUpdateStorageKey = (productId: string) => `able-lubes:pending-product-update:${productId}`;

const readPendingProductUpdate = (productId: string): PendingProductUpdate | null => {
  try {
    const stored = localStorage.getItem(pendingProductUpdateStorageKey(productId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PendingProductUpdate;
    return parsed?.idempotencyKey && parsed?.payload?.batchPricing ? parsed : null;
  } catch {
    return null;
  }
};

const writePendingProductUpdate = (productId: string, pending: PendingProductUpdate) => {
  try {
    localStorage.setItem(pendingProductUpdateStorageKey(productId), JSON.stringify(pending));
  } catch {
    // The in-memory retry key still protects retries while this view remains open.
  }
};

const clearPendingProductUpdate = (productId: string) => {
  try {
    localStorage.removeItem(pendingProductUpdateStorageKey(productId));
  } catch {
    // Storage is best-effort; server-side idempotency remains authoritative.
  }
};

const createBatchDraft = (): BatchDraft => ({
  key: crypto.randomUUID(),
  quantity: "",
  purchaseRate: "",
  sellingRate: "",
  mrp: "",
  isNew: true,
});

const getDistinctBatchPriceCount = (product: Product) => {
  return getBatchPriceGroups(product).length;
};

const getBatchPriceGroups = (product: Product) => {
  const groups = new Map<
    string,
    { purchaseRate: number; sellingRate: number; mrp: number | null; batches: Product["batches"] }
  >();

  product.batches
    .filter((batch) => batch.remainingQuantity > 0)
    .forEach((batch) => {
      const purchaseRate = Number(batch.purchaseRate.toFixed(2));
      const sellingRate = Number(batch.sellingRate.toFixed(2));
      const mrp = batch.mrp == null ? null : Number(batch.mrp.toFixed(2));
      const key = `${purchaseRate.toFixed(2)}:${sellingRate.toFixed(2)}:${mrp == null ? "null" : mrp.toFixed(2)}`;
      const group = groups.get(key) ?? {
        purchaseRate,
        sellingRate,
        mrp,
        batches: [],
      };
      group.batches.push(batch);
      groups.set(key, group);
    });

  return Array.from(groups.values())
    .map((group) => {
      const receivedDates = group.batches
        .map((batch) => new Date(batch.receivedAt))
        .filter((date) => Number.isFinite(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      const dateLabel = (date: Date) =>
        date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      const dateRangeLabel = (start: Date, end: Date) => {
        if (start.toDateString() === end.toDateString()) return dateLabel(start);
        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
          const month = start.toLocaleDateString("en-US", { month: "short" });
          return `${month} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
        }
        if (start.getFullYear() === end.getFullYear()) {
          const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `${startLabel} – ${endLabel}, ${start.getFullYear()}`;
        }
        return `${dateLabel(start)} – ${dateLabel(end)}`;
      };
      const firstDate = receivedDates[0];
      const lastDate = receivedDates[receivedDates.length - 1];

      return {
        ...group,
        quantity: group.batches.reduce((total, batch) => total + batch.remainingQuantity, 0),
        purchaseDate: firstDate
          ? dateRangeLabel(firstDate, lastDate ?? firstDate)
          : "—",
        firstReceivedAt: firstDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.firstReceivedAt - b.firstReceivedAt);
};

export const ProductEntryView: React.FC = () => {
  const {
    authSession,
    products,
    brands,
    units,
    createBrand,
    createUnit,
    updateUnit,
    addProduct,
    updateProduct,
    deleteProduct,
    masterDataLoading,
    masterDataError,
    catalogLoading,
    catalogError,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [deletingProductIds, setDeletingProductIds] = useState<Set<string>>(
    () => new Set(),
  );
  const deletingProductIdsRef = useRef(new Set<string>());
  const [priceViewProduct, setPriceViewProduct] = useState<Product | null>(null);
  const [batchStockInfoOpen, setBatchStockInfoOpen] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formBrandId, setFormBrandId] = useState("");
  const [formUnitId, setFormUnitId] = useState("");
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [defaultBatchKey, setDefaultBatchKey] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [pendingRetryAvailable, setPendingRetryAvailable] = useState(false);
  const [focusNewBatchKey, setFocusNewBatchKey] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastFocusedBatchFieldRef = useRef("quantity");
  const productUpdateInFlightRef = useRef(false);
  const [catalogModal, setCatalogModal] = useState<"brand" | null>(null);
  const [catalogName, setCatalogName] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [unitEditorOpen, setUnitEditorOpen] = useState(false);
  const [unitManagerOpen, setUnitManagerOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<
    (typeof units)[number] | undefined
  >();

  // Filtering
  const filteredProducts = products.filter((p) => {
    if (p.status !== "Active") return false;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q);

    const matchesBrand =
      brandFilter === "all" ||
      p.brand.toLowerCase() === brandFilter.toLowerCase();

    let matchesStock = true;
    if (stockFilter === "in_stock")
      matchesStock = p.quantity > (p.minThreshold || 10);
    if (stockFilter === "low_stock")
      matchesStock = p.quantity <= (p.minThreshold || 10);

    return matchesSearch && matchesBrand && matchesStock;
  });
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / DEFAULT_PAGE_SIZE));
  const safeProductPage = Math.min(productPage, pageCount);
  const pageProducts = getPageRecords(filteredProducts, safeProductPage);
  const productRange = getPaginationRange(filteredProducts.length, safeProductPage);
  useEffect(() => setProductPage(1), [searchTerm, brandFilter, stockFilter]);
  useEffect(() => {
    if (!priceViewProduct) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPriceViewProduct(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [priceViewProduct]);
  useEffect(() => {
    if (!batchStockInfoOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBatchStockInfoOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [batchStockInfoOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);
  useEffect(() => {
    if (!focusNewBatchKey) return;
    const frame = window.requestAnimationFrame(() => {
      const input = formRef.current?.querySelector<HTMLElement>(
        `[data-batch-key="${focusNewBatchKey}"][data-batch-field="quantity"]`,
      );
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ block: "nearest", inline: "nearest" });
      setFocusNewBatchKey(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [batchDrafts, focusNewBatchKey]);
  const brandNames = Array.from(
    new Set(products.map((product) => product.brand).filter(Boolean)),
  );
  const productBeingEdited =
    drawerMode === "edit"
      ? products.find((product) => product.id === editingId)
      : undefined;
  const isAdmin = authSession?.user.role === "ADMIN";
  const batchStockTotal = batchDrafts.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
  const selectedUnit = units.find((unit) => unit.id === formUnitId);
  const selectedUnitAllowsDecimals =
    selectedUnit?.allowsDecimals ??
    productBeingEdited?.unitAllowsDecimals ??
    false;
  const handleProductFormArrowNavigation = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const current = event.currentTarget;
    const isTextInput = current instanceof HTMLInputElement;
    if (isTextInput && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const atBoundary = current.selectionStart === current.selectionEnd &&
        (event.key === 'ArrowLeft' ? current.selectionStart === 0 : current.selectionEnd === current.value.length);
      if (!atBoundary) return;
    } else if (!isTextInput && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      return;
    }
    const field = current.dataset.productFormField;
    const directions: Record<string, string> = {
      'name:ArrowDown': 'brand',
      'brand:ArrowUp': 'name', 'brand:ArrowRight': 'unit', 'brand:ArrowDown': 'qty',
      'unit:ArrowUp': 'name', 'unit:ArrowLeft': 'brand', 'unit:ArrowDown': 'qty',
      'qty:ArrowUp': 'brand', 'qty:ArrowDown': 'reason',
      'reason:ArrowUp': 'qty', 'reason:ArrowDown': 'selling',
      'selling:ArrowUp': 'qty', 'selling:ArrowRight': 'purchase', 'selling:ArrowDown': 'mrp',
      'purchase:ArrowUp': 'unit', 'purchase:ArrowLeft': 'selling', 'purchase:ArrowDown': 'mrp',
      'mrp:ArrowUp': 'selling', 'mrp:ArrowLeft': 'purchase', 'mrp:ArrowDown': 'save',
    };
    let destination = directions[`${field}:${event.key}`];
    if (field === 'qty' && event.key === 'ArrowDown' && !current.form?.querySelector('[data-product-form-field="reason"]')) {
      destination = 'selling';
    }
    const next = destination
      ? current.form?.querySelector<HTMLElement>(`[data-product-form-field="${destination}"]`)
      : null;
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const updateBatchDraft = (key: string, updates: Partial<BatchDraft>) => {
    setBatchDrafts((previous) => previous.map((batch) => batch.key === key ? { ...batch, ...updates } : batch));
  };

  const addAnotherBatch = () => {
    const batch = createBatchDraft();
    setBatchDrafts((previous) => [...previous, batch]);
    setFocusNewBatchKey(batch.key);
    if (!defaultBatchKey) setDefaultBatchKey(batch.key);
  };

  const handleBatchGridNavigation = (event: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) => {
    const { key } = event;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;
    const form = formRef.current;
    if (!form) return;
    const current = event.currentTarget;
    const addBatchButton = form.querySelector<HTMLButtonElement>("[data-add-batch]");
    const submitButton = form.querySelector<HTMLButtonElement>("[data-product-submit]");

    if (current === submitButton && key === "ArrowUp" && addBatchButton) {
      event.preventDefault();
      addBatchButton.focus();
      addBatchButton.scrollIntoView({ block: "nearest" });
      return;
    }
    if (current === addBatchButton) {
      if (key === "ArrowDown" && submitButton) {
        event.preventDefault();
        submitButton.focus();
        submitButton.scrollIntoView({ block: "nearest" });
      } else if (key === "ArrowUp") {
        const rows = Array.from(form.querySelectorAll<HTMLElement>("[data-batch-row]"));
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          const candidate = rows[index].querySelector<HTMLElement>(
            `[data-batch-field="${lastFocusedBatchFieldRef.current}"]`,
          );
          if (candidate && !candidate.matches(":disabled, [readonly]")) {
            event.preventDefault();
            candidate.focus();
            candidate.scrollIntoView({ block: "nearest", inline: "nearest" });
            return;
          }
        }
      }
      return;
    }

    const row = current.closest<HTMLElement>("[data-batch-row]");
    const field = current.dataset.batchField;
    if (!row || !field) return;
    lastFocusedBatchFieldRef.current = field;

    if (key === "ArrowLeft" || key === "ArrowRight") {
      const input = current as HTMLInputElement;
      const hasSelection = input.selectionStart !== input.selectionEnd;
      const atBoundary = key === "ArrowLeft"
        ? input.selectionStart === 0
        : input.selectionEnd === input.value.length;
      if (hasSelection || !atBoundary) return;
      const fields = ["quantity", "purchaseRate", "sellingRate", "mrp"];
      const direction = key === "ArrowRight" ? 1 : -1;
      let index = fields.indexOf(field) + direction;
      while (index >= 0 && index < fields.length) {
        const candidate = row.querySelector<HTMLElement>(`[data-batch-field="${fields[index]}"]`);
        if (candidate && !candidate.matches(":disabled, [readonly]")) {
          event.preventDefault();
          candidate.focus();
          candidate.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }
        index += direction;
      }
      return;
    }

    const rows = Array.from(form.querySelectorAll<HTMLElement>("[data-batch-row]"));
    const rowIndex = rows.indexOf(row);
    const direction = key === "ArrowDown" ? 1 : -1;
    let nextIndex = rowIndex + direction;
    while (nextIndex >= 0 && nextIndex < rows.length) {
      const candidate = rows[nextIndex].querySelector<HTMLElement>(`[data-batch-field="${field}"]`);
      if (candidate && !candidate.matches(":disabled, [readonly]")) {
        event.preventDefault();
        candidate.focus();
        candidate.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      nextIndex += direction;
    }
    if (key === "ArrowDown" && rowIndex === rows.length - 1 && addBatchButton) {
      event.preventDefault();
      addBatchButton.focus();
      addBatchButton.scrollIntoView({ block: "nearest" });
    }
  };

  const removeBatchDraft = (key: string) => {
    const remaining = batchDrafts.filter((batch) => batch.key !== key);
    setBatchDrafts(remaining);
    if (defaultBatchKey === key) {
      const replacement = remaining.find((batch) => Number(batch.quantity) > 0);
      setDefaultBatchKey(replacement?.key || "");
    }
  };

  const openCreateDrawer = () => {
    productUpdateInFlightRef.current = false;
    setPendingRetryAvailable(false);
    setDrawerMode("create");
    setEditingId(null);
    setFormName("");
    setFormBrandId("");
    setFormUnitId("");
    const firstBatch = createBatchDraft();
    setBatchDrafts([firstBatch]);
    setDefaultBatchKey(firstBatch.key);
    setDrawerOpen(true);
  };

  const openEditDrawer = (product: Product) => {
    setDrawerMode("edit");
    setEditingId(product.id);
    setFormName(product.name);
    const productBrand = brands.find(
      (brand) => brand.id === product.brandId || brand.name === product.brand,
    );
    const productUnit = units.find(
      (unit) =>
        unit.id === product.unitId ||
        unit.symbol === product.unit ||
        unit.name === product.unit,
    );
    setFormBrandId(product.brandId || productBrand?.id || "");
    setFormUnitId(product.unitId || productUnit?.id || "");
    const existingBatches = product.batches.map((batch) => ({
      key: batch.id,
      id: batch.id,
      quantity: String(batch.remainingQuantity),
      purchaseRate: String(batch.purchaseRate),
      sellingRate: String(batch.sellingRate),
      mrp: batch.mrp == null ? "" : String(batch.mrp),
      isNew: false,
      original: {
        quantity: String(batch.remainingQuantity),
        sellingRate: String(batch.sellingRate),
        mrp: batch.mrp == null ? "" : String(batch.mrp),
      },
    }));
    setBatchDrafts(existingBatches);
    const defaultBatch = existingBatches.find((batch) => product.batches.find((source) => source.id === batch.id)?.isDefaultSellingRate)
      || existingBatches.find((batch) => Number(batch.sellingRate) === product.sellingPrice);
    const availableDefault = defaultBatch && Number(defaultBatch.quantity) > 0
      ? defaultBatch
      : existingBatches.find((batch) => Number(batch.quantity) > 0);
    setDefaultBatchKey(availableDefault?.key || "");
    const pendingUpdate = readPendingProductUpdate(product.id);
    setPendingRetryAvailable(Boolean(pendingUpdate));
    if (pendingUpdate) {
      showToast("A previous update has an uncertain result. Confirm it first; any edits in this drawer will need to be applied after reopening.", "error");
    }
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productUpdateInFlightRef.current) return;
    const pendingRetry = drawerMode === "edit" && editingId ? readPendingProductUpdate(editingId) : null;
    if (pendingRetry && editingId) {
      productUpdateInFlightRef.current = true;
      setFormSaving(true);
      try {
        await updateProduct(editingId, pendingRetry.payload);
        clearPendingProductUpdate(editingId);
        setPendingRetryAvailable(false);
        setDrawerOpen(false);
        showToast("The previous product update was confirmed. Reopen the product to make further changes.");
      } catch (error) {
        if (error instanceof ApiClientError && error.status !== undefined && error.status >= 400 && error.status < 500 && !error.message.includes("still resolving")) {
          clearPendingProductUpdate(editingId);
          setPendingRetryAvailable(false);
        }
        showToast(error instanceof Error ? error.message : "Unable to confirm the previous product update.", "error");
      } finally {
        productUpdateInFlightRef.current = false;
        setFormSaving(false);
      }
      return;
    }
    if (
      !formName.trim() ||
      !formBrandId ||
      !formUnitId ||
      !batchDrafts.length
    ) {
      showToast("Enter the product details and add at least one batch.", "error");
      return;
    }
    if (!isUuid(formBrandId) || !isUuid(formUnitId)) {
      showToast(
        "Choose a brand and unit with valid IDs from the API list, then try again.",
        "error",
      );
      return;
    }
    const batchesByKey = new Map(batchDrafts.map((batch) => [batch.key, batch]));
    const totalStock = batchDrafts.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
    const newBatchCount = batchDrafts.filter((batch) => batch.isNew).length;
    for (const batch of batchDrafts) {
      const quantity = Number(batch.quantity);
      const purchaseRate = Number(batch.purchaseRate);
      const sellingRate = Number(batch.sellingRate);
      const mrp = batch.mrp.trim() ? Number(batch.mrp) : undefined;
      if (!Number.isFinite(quantity) || (batch.isNew ? quantity <= 0 : quantity < 0)) {
        showToast(`Enter a valid ${batch.isNew ? "positive" : "non-negative"} quantity for each batch.`, "error");
        return;
      }
      if (!isUnitQuantityValid(quantity, selectedUnitAllowsDecimals)) {
        showToast(selectedUnitAllowsDecimals ? "Batch quantities can have up to 3 decimal places." : "This unit only allows whole-number quantities.", "error");
        return;
      }
      if (!Number.isFinite(purchaseRate) || purchaseRate <= 0 || !Number.isFinite(sellingRate) || sellingRate <= 0) {
        showToast("Purchase and selling prices must be greater than ₹0.00 for every batch.", "error");
        return;
      }
      if (mrp !== undefined && (!Number.isFinite(mrp) || mrp <= sellingRate)) {
        showToast("Batch MRP must be greater than its selling price.", "error");
        return;
      }
      if (batch.isNew) continue;
      const originalBatch = productBeingEdited?.batches.find((entry) => entry.id === batch.id);
      if (originalBatch && quantity > originalBatch.remainingQuantity) {
        showToast("Increase stock by adding another batch; existing batch quantities cannot be increased.", "error");
        return;
      }
      if (originalBatch && quantity < originalBatch.remainingQuantity && !isAdmin) {
        showToast("Only Admin users can reduce batch stock.", "error");
        return;
      }
    }
    const selectedDefault = batchesByKey.get(defaultBatchKey);
    if (!selectedDefault || Number(selectedDefault.quantity) <= 0) {
      showToast("Choose a default selling rate from a batch with available stock.", "error");
      return;
    }
    if (drawerMode === "create" && totalStock <= 0) {
      showToast("Initial stock must be greater than zero. Add a batch with a positive quantity.", "error");
      return;
    }
    if (drawerMode === "edit" && newBatchCount > 0 && !isAdmin) {
      showToast("Only Admin users can add stock batches.", "error");
      return;
    }
    productUpdateInFlightRef.current = true;
    setFormSaving(true);
    try {
      const basePayload = {
        name: formName.trim(),
        brandId: formBrandId,
        unitId: formUnitId,
      };
      if (drawerMode === "create") {
        const defaultSellingPrice = Number(selectedDefault!.sellingRate);
        const defaultMrp = selectedDefault!.mrp.trim() ? Number(selectedDefault!.mrp) : null;
        const totalCost = batchDrafts.reduce((sum, batch) => sum + Number(batch.quantity) * Number(batch.purchaseRate), 0);
        await addProduct({
          ...basePayload,
          purchaseRate: totalStock > 0 ? Math.round((totalCost / totalStock) * 100) / 100 : Number(selectedDefault!.purchaseRate),
          sellingPrice: defaultSellingPrice,
          mrp: defaultMrp,
          qty: totalStock,
          batches: batchDrafts.map((batch) => ({
            clientKey: batch.key,
            quantity: Number(batch.quantity),
            purchaseRate: Number(batch.purchaseRate),
            sellingRate: Number(batch.sellingRate),
            mrp: batch.mrp.trim() ? Number(batch.mrp) : null,
            isDefaultSellingRate: batch.key === defaultBatchKey,
          })),
        });
      }
      else if (editingId) {
        const updates = batchDrafts.filter((batch) => !batch.isNew).flatMap((batch) => {
          const original = batch.original;
          if (!original) return [];
          const change: NonNullable<UpdateProductPayload["batchPricing"]>["updates"][number] = { id: batch.id! };
          const initialQuantity = Number(original.quantity);
          const nextQuantity = Number(batch.quantity);
          if (initialQuantity !== nextQuantity) {
            change.expectedRemainingQuantity = initialQuantity;
            change.remainingQuantity = nextQuantity;
          }
          if (Number(original.sellingRate) !== Number(batch.sellingRate)) change.sellingRate = Number(batch.sellingRate);
          const initialMrp = original.mrp.trim() ? Number(original.mrp) : null;
          const nextMrp = batch.mrp.trim() ? Number(batch.mrp) : null;
          if (initialMrp !== nextMrp) change.mrp = nextMrp;
          return Object.keys(change).length > 1 ? [change] : [];
        });
        const idempotencyKey = crypto.randomUUID();
        const pending: PendingProductUpdate = {
          idempotencyKey,
          payload: {
            ...basePayload,
            idempotencyKey,
            batchPricing: {
              updates,
              additions: batchDrafts.filter((batch) => batch.isNew).map((batch) => ({
                clientKey: batch.key,
                quantity: Number(batch.quantity),
                purchaseRate: Number(batch.purchaseRate),
                sellingRate: Number(batch.sellingRate),
                mrp: batch.mrp.trim() ? Number(batch.mrp) : null,
              })),
              defaultBatchKey: defaultBatchKey || null,
            },
          },
        };
        writePendingProductUpdate(editingId, pending);
        setPendingRetryAvailable(true);
        await updateProduct(editingId, pending.payload);
        clearPendingProductUpdate(editingId);
        setPendingRetryAvailable(false);
      }
      setDrawerOpen(false);
    } catch (error) {
      if (drawerMode === "edit" && editingId && error instanceof ApiClientError && error.status !== undefined && error.status >= 400 && error.status < 500 && !error.message.includes("still resolving")) {
        clearPendingProductUpdate(editingId);
        setPendingRetryAvailable(false);
      }
      showToast(
        error instanceof Error ? error.message : "Unable to save the product.",
        "error",
      );
    } finally {
      productUpdateInFlightRef.current = false;
      setFormSaving(false);
    }
  };

  const openCatalogModal = (kind: "brand" | "unit") => {
    if (kind === "unit") {
      setEditingUnit(undefined);
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
        setFormBrandId(brand.id);
      }
      setCatalogModal(null);
      setCatalogName("");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : `Unable to add the ${catalogModal || "option"}.`,
        "error",
      );
    } finally {
      setCatalogSaving(false);
    }
  };

  const saveUnit = async (payload: {
    id?: string;
    name: string;
    symbol: string | null;
    allowsDecimals: boolean;
  }) => {
    const unit = payload.id
      ? await updateUnit(payload.id, {
          name: payload.name,
          symbol: payload.symbol,
          allowsDecimals: payload.allowsDecimals,
        })
      : await createUnit(payload.name, payload.symbol, payload.allowsDecimals);
    setFormUnitId(unit.id);
  };

  const handleDelete = async (id: string, name: string) => {
    if (deletingProductIdsRef.current.has(id)) return;
    deletingProductIdsRef.current.add(id);
    setDeletingProductIds(new Set(deletingProductIdsRef.current));
    try {
      if (
        !window.confirm(
          `Are you sure you want to remove "${name}" from the billing catalog?`,
        )
      ) return;
      await deleteProduct(id);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Unable to deactivate the product.",
        "error",
      );
    } finally {
      deletingProductIdsRef.current.delete(id);
      setDeletingProductIds(new Set(deletingProductIdsRef.current));
    }
  };

  const handleExportCatalog = () => {
    const csvRows = [
      [
        "Product Name",
        "Brand",
        "Selling Price (INR)",
        "MRP (INR)",
        "Current Stock",
        "Status",
      ],
      ...products
        .filter((product) => product.status === "Active")
        .map((p) => [
          `"${p.name.replace(/"/g, '""')}"`,
          p.brand,
          formatCurrency(p.sellingPrice),
          p.mrp > 0 ? formatCurrency(p.mrp) : "—",
          p.quantity.toString(),
          p.status,
        ]),
    ];
    const csvContent = csvRows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Catalog_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast("Catalog exported to CSV successfully.");
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {masterDataError && (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/50 px-3 py-2 text-sm text-error"
        >
          {masterDataError}
        </div>
      )}
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-end justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-outline-variant/20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-space-sm flex-1 min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
              search
            </span>
            <input
              className="w-full h-8 pl-8 pr-space-md bg-surface-container-low text-on-surface font-body-md text-body-md rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary placeholder:text-outline"
              placeholder="Search by product name or brand"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Brand Filter */}
          <label className="relative sm:w-36 shrink-0 flex flex-col gap-1 text-[11px] font-medium text-on-surface-variant">
            Brand
            <select
              className="w-full h-8 pl-space-sm pr-8 bg-surface-container-low text-on-surface font-body-md text-body-md rounded appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary cursor-pointer"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="all">All Brands</option>
              {brandNames.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-[27px] -translate-y-1/2 text-outline text-[16px] pointer-events-none">
              expand_more
            </span>
          </label>

          {/* Stock Status Filter */}
          <label className="relative sm:w-32 shrink-0 flex flex-col gap-1 text-[11px] font-medium text-on-surface-variant">
            Stock
            <select
              className="w-full h-8 pl-space-sm pr-8 bg-surface-container-low text-on-surface font-body-md text-body-md rounded appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary cursor-pointer"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-[27px] -translate-y-1/2 text-outline text-[16px] pointer-events-none">
              expand_more
            </span>
          </label>
        </div>

        {/* Search toolbar actions */}
        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 text-on-surface-variant font-label-md text-label-md shrink-0">
          <button
            className="hover:text-primary transition-colors text-outline px-1"
            onClick={() => {
              setSearchTerm("");
              setBrandFilter("all");
              setStockFilter("all");
            }}
            type="button"
          >
            Reset
          </button>
          <span className="hidden xl:block h-6 w-px bg-outline-variant/60 mx-1" />
          <button
            className="h-8 px-3 rounded-md bg-primary hover:bg-primary-container text-on-primary font-label-md flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            onClick={openCreateDrawer}
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            <span>Add Product</span>
          </button>
          <button
            className="hidden h-8 px-3 rounded border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md items-center gap-1 transition-colors whitespace-nowrap"
            type="button"
            onClick={handleExportCatalog}
          >
            <span className="material-symbols-outlined text-[16px]">
              file_download
            </span>
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Product Management Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low h-9">
                <th className="py-2 px-space-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Product Name
                </th>
                <th className="py-2 px-space-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Brand
                </th>
                <th className="py-2 px-space-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                  Selling Price
                </th>
                <th className="py-2 px-space-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                  MRP
                </th>
                <th className="py-2 px-space-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-center">
                  Current Stock
                </th>
                <th className="py-2 px-space-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/70">
              {masterDataLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-on-surface-variant"
                  >
                    Loading products from API…
                  </td>
                </tr>
              )}
              {!masterDataLoading &&
                pageProducts.map((p, idx) => {
                  return (
                    <tr
                      key={p.id}
                      aria-busy={deletingProductIds.has(p.id)}
                      className={`hover:bg-surface-container-low transition-colors group ${
                        idx % 2 === 1 ? "bg-surface-container-lowest/50" : ""
                      }`}
                    >
                      <td className="py-2.5 px-space-md min-w-[240px]">
                        <div className="flex flex-col">
                          <span className="font-title-md text-body-md font-medium text-on-surface">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-space-md font-body-md text-body-md text-on-surface whitespace-nowrap">
                        <span className="bg-surface-container px-2 py-0.5 rounded font-label-sm text-label-sm text-on-surface-variant">
                          {p.brand || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-data-mono-md text-data-mono-md text-on-surface font-semibold">
                            {formatCurrency(p.sellingPrice)}
                          </span>
                          {getDistinctBatchPriceCount(p) > 1 && (
                            <button
                              type="button"
                              onClick={() => setPriceViewProduct(p)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary-container/40 px-2 py-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-primary-container hover:text-on-surface"
                              aria-label={`View all ${p.batches.filter((batch) => batch.remainingQuantity > 0).length} batch prices for ${p.name}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">layers</span>
                              View All Prices ({getDistinctBatchPriceCount(p)})
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-space-md font-data-mono-md text-data-mono-md text-on-surface-variant text-right whitespace-nowrap">
                        {p.mrp > 0 ? formatCurrency(p.mrp) : "—"}
                      </td>
                      <td className="py-2.5 px-space-md text-center whitespace-nowrap">
                        <span className="font-data-mono-md text-data-mono-md font-medium text-on-surface">
                          {p.quantity}
                        </span>
                      </td>
                      <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                            onClick={() => openEditDrawer(p)}
                            title="Edit Product"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                          <button
                            className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void handleDelete(p.id, p.name)}
                            aria-label={deletingProductIds.has(p.id) ? "Deleting product" : "Deactivate product"}
                            disabled={deletingProductIds.has(p.id)}
                            title={deletingProductIds.has(p.id) ? "Deleting product…" : "Deactivate Product"}
                            type="button"
                          >
                            <span className={`material-symbols-outlined text-[18px] ${deletingProductIds.has(p.id) ? "animate-spin" : ""}`}>
                              {deletingProductIds.has(p.id) ? "progress_activity" : "delete"}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!masterDataLoading && !filteredProducts.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-on-surface-variant"
                  >
                    {masterDataError
                      ? "Products could not be loaded."
                      : "No products match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Controls */}
        <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm font-label-md text-label-md text-on-surface-variant border-t border-outline-variant/20">
          <div className="flex items-center gap-space-xs">
            <span className="font-data-mono-sm text-data-mono-sm">
              Showing{" "}
              <strong className="text-on-surface font-semibold">
                {productRange.start}-{productRange.end}
              </strong>{" "}
              of{" "}
              <strong className="text-on-surface font-semibold">
                {filteredProducts.length}
              </strong>{" "}
              matching products <span className="text-outline">({products.length} total)</span>
            </span>
          </div>
          <PaginationControls totalRecords={filteredProducts.length} page={safeProductPage} pageSize={DEFAULT_PAGE_SIZE} onPageChange={setProductPage} />
        </div>
      </div>

      {priceViewProduct && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/40 p-3 sm:p-6"
          onClick={() => setPriceViewProduct(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-prices-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-outline-variant/30 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="batch-prices-title" className="font-headline-sm text-headline-sm text-on-surface">
                  Batch Prices
                </h2>
                <p className="mt-1 truncate font-body-md text-body-md text-on-surface-variant">
                  {priceViewProduct.name}{priceViewProduct.brand ? ` · ${priceViewProduct.brand}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPriceViewProduct(null)}
                className="shrink-0 rounded-md p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                aria-label="Close batch prices"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>

            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="rounded-lg border border-outline-variant/30">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[6%]" />
                    <col className="w-[22%]" />
                    <col className="w-[24%]" />
                    <col className="w-[24%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-surface-container-low">
                    <tr>
                      <th className="px-2 py-3 font-label-md text-label-md text-on-surface-variant">#</th>
                      <th className="break-words px-2 py-3 text-center font-label-md text-label-md text-on-surface-variant">Quantity</th>
                      <th className="break-words px-2 py-3 text-right font-label-md text-label-md text-on-surface-variant">Purchase Price</th>
                      <th className="break-words px-2 py-3 text-right font-label-md text-label-md text-on-surface-variant">Selling Price</th>
                      <th className="break-words px-2 py-3 text-right font-label-md text-label-md text-on-surface-variant">MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getBatchPriceGroups(priceViewProduct).map((group, index) => (
                      <tr key={`${group.purchaseRate}-${group.sellingRate}-${group.mrp == null ? "no-mrp" : group.mrp.toFixed(2)}`} className="border-t border-outline-variant/30">
                        <td className="px-2 py-3 font-data-mono-md text-data-mono-md text-on-surface">{index + 1}</td>
                        <td className="break-words px-2 py-3 text-center font-data-mono-md text-data-mono-md text-on-surface">
                          {group.quantity} {priceViewProduct.unit}
                        </td>
                        <td className="break-words px-2 py-3 text-right font-data-mono-md text-data-mono-md text-on-surface">
                          {formatCurrency(group.purchaseRate)}
                        </td>
                        <td className="break-words px-2 py-3 text-right font-data-mono-md text-data-mono-md text-on-surface">
                          {formatCurrency(group.sellingRate)}
                        </td>
                        <td className="break-words px-2 py-3 text-right font-data-mono-md text-data-mono-md text-on-surface">
                          {group.mrp == null ? "—" : formatCurrency(group.mrp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-outline-variant/40 bg-surface-container-low">
                    <tr>
                      <th className="px-2 py-3 text-left font-label-lg text-label-lg font-semibold text-on-surface">Total</th>
                      <th className="break-words px-2 py-3 text-center font-data-mono-md text-data-mono-md font-semibold text-on-surface">
                        {priceViewProduct.batches
                          .filter((batch) => batch.remainingQuantity > 0)
                          .reduce((total, batch) => total + batch.remainingQuantity, 0)} {priceViewProduct.unit}
                      </th>
                      <th className="px-2 py-3 text-right font-label-lg text-label-lg font-semibold text-on-surface-variant">—</th>
                      <th className="px-2 py-3 text-right font-label-lg text-label-lg font-semibold text-on-surface-variant">—</th>
                      <th className="px-2 py-3 text-right font-label-lg text-label-lg font-semibold text-on-surface-variant">—</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Centered Add / Edit Product modal */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-5"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-[1150px] flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-2xl sm:w-[85vw] lg:w-[78vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-outline-variant/20 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-col">

                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  {drawerMode === "create"
                    ? "Add New Product"
                    : "Edit Product"}
                </h2>
              </div>
              <button
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            {/* Add/Edit Product Form */}
            <form
              ref={formRef}
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={handleFormSubmit}
            >
              <div className="min-h-0 flex-1 overflow-y-auto bg-white p-3 sm:p-4">
              <section className="mb-3 overflow-hidden rounded-xl border border-outline-variant/30 bg-white">
              <div className="p-3">
              {catalogError && (
                <p
                  role="alert"
                  className="mb-3 rounded-md bg-error-container px-3 py-2 text-xs text-on-error-container"
                >
                  Brand and unit options could not be loaded: {catalogError}
                </p>
              )}
              <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
              {/* Product Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between">
                  <span>Product Name</span>
                  <span className="text-error font-data-mono-sm text-data-mono-sm">
                    *Required
                  </span>
                </label>
                <input
                  className="h-8 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary placeholder:text-outline"
                  placeholder="e.g., Engine Oil 5W-30 Synthetic"
                  required
                  type="text"
                  data-product-form-field="name"
                  onKeyDown={handleProductFormArrowNavigation}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 text-[12px] font-medium text-on-surface">
                  <label>
                    Brand
                    <select
                      required
                      data-product-form-field="brand"
                      onKeyDown={handleProductFormArrowNavigation}
                      value={formBrandId}
                      onChange={(e) => setFormBrandId(e.target.value)}
                      disabled={catalogLoading}
                      className="mt-1.5 h-8 w-full px-2 bg-surface-container-low border border-outline-variant rounded text-on-surface font-normal"
                    >
                      <option value="">
                        {catalogLoading ? "Loading brands…" : "Select brand"}
                      </option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="self-start text-primary text-xs"
                    onClick={() => openCatalogModal("brand")}
                  >
                    + Add brand
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 text-[12px] font-medium text-on-surface">
                  <label>
                    Unit
                    <select
                      required
                      data-product-form-field="unit"
                      onKeyDown={handleProductFormArrowNavigation}
                      value={formUnitId}
                      onChange={(e) => setFormUnitId(e.target.value)}
                      disabled={catalogLoading}
                      className="mt-1.5 h-8 w-full px-2 bg-surface-container-low border border-outline-variant rounded text-on-surface font-normal disabled:opacity-70"
                    >
                      <option value="">
                        {catalogLoading ? "Loading units…" : "Select unit"}
                      </option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                          {unit.symbol ? ` (${unit.symbol})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="self-start text-primary text-xs"
                    onClick={() => openCatalogModal("unit")}
                  >
                    + Add unit
                  </button>
                  <button
                    type="button"
                    className="self-start text-primary text-xs"
                    onClick={() => setUnitManagerOpen(true)}
                  >
                    Manage units
                  </button>

                </div>
              </div>
              </div>
              </section>

              <section className="rounded-xl border border-outline-variant/30 bg-white p-2.5 sm:p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">layers</span>
                    <h3 className="font-label-lg text-label-lg font-semibold text-on-surface">Batch-wise Pricing</h3>
                  </div>
                  {drawerMode === "edit" && (
                    <button
                      type="button"
                      onClick={() => setBatchStockInfoOpen(true)}
                      className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                      aria-label="Batch quantity restrictions"
                      title="Batch quantity restrictions"
                    >
                      <span className="material-symbols-outlined text-[18px]">info</span>
                    </button>
                  )}
                </div>
                  <div className="overflow-x-auto rounded-lg border border-outline-variant/30 lg:overflow-x-visible">
                    <table className="w-full min-w-[760px] table-fixed border-collapse text-left lg:min-w-0">
                      <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[20%]" />
                        <col className="w-[17%]" />
                        <col className="w-[17%]" />
                        <col className="w-[17%]" />
                        <col className="w-[9%]" />
                        <col className="w-[8%]" />
                      </colgroup>
                      <thead className="bg-surface-container-low">
                        <tr>
                          <th className="px-1.5 py-2 text-center font-label-sm text-label-sm text-on-surface-variant">#</th>
                          <th className="px-1.5 py-2 font-label-sm text-label-sm text-on-surface-variant">{drawerMode === "edit" ? "Quantity (Available)" : "Quantity"}</th>
                          <th className="px-1.5 py-2 font-label-sm text-label-sm text-on-surface-variant">Purchase Price</th>
                          <th className="px-1.5 py-2 font-label-sm text-label-sm text-on-surface-variant">Selling Price</th>
                          <th className="px-1.5 py-2 font-label-sm text-label-sm text-on-surface-variant">MRP</th>
                          <th className="px-1 py-2 text-center font-label-sm text-label-sm text-on-surface-variant">Default</th>
                          <th className="px-1 py-2 text-center font-label-sm text-label-sm text-on-surface-variant">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchDrafts.map((batch, index) => {
                          const isDefault = defaultBatchKey === batch.key;
                          return (
                            <React.Fragment key={batch.key}>
                            <tr data-batch-row data-batch-key={batch.key} className="border-t border-outline-variant/30">
                              <td className="px-1.5 py-1.5 text-center align-middle">
                                <span className="font-data-mono-md text-data-mono-md text-on-surface">{index + 1}</span>
                              </td>
                              <td className="px-1.5 py-1.5 align-middle">
                                <NumericTextInput required maxDecimals={selectedUnitAllowsDecimals ? 3 : 0} value={batch.quantity} onValueChange={(quantity) => updateBatchDraft(batch.key, { quantity })} onFocus={() => { lastFocusedBatchFieldRef.current = "quantity"; }} onKeyDown={handleBatchGridNavigation} data-batch-field="quantity" data-product-form-field="qty" readOnly={!batch.isNew && !isAdmin} aria-label={`Available quantity for batch ${index + 1}`} className="h-8 w-full rounded border border-outline-variant bg-white px-2 text-xs font-normal text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" />
                              </td>
                              <td className="px-1.5 py-1.5 align-middle">
                                <NumericTextInput required maxDecimals={2} value={batch.purchaseRate} onValueChange={(purchaseRate) => updateBatchDraft(batch.key, { purchaseRate })} onFocus={() => { lastFocusedBatchFieldRef.current = "purchaseRate"; }} onKeyDown={handleBatchGridNavigation} data-batch-field="purchaseRate" readOnly={!batch.isNew} aria-label={`Purchase price for batch ${index + 1}`} className="h-8 w-full rounded border border-outline-variant bg-white px-2 text-xs font-normal text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" />
                              </td>
                              <td className="px-1.5 py-1.5 align-middle">
                                <NumericTextInput required maxDecimals={2} value={batch.sellingRate} onValueChange={(sellingRate) => updateBatchDraft(batch.key, { sellingRate })} onFocus={() => { lastFocusedBatchFieldRef.current = "sellingRate"; }} onKeyDown={handleBatchGridNavigation} data-batch-field="sellingRate" aria-label={`Selling price for batch ${index + 1}`} className="h-8 w-full rounded border border-outline-variant bg-white px-2 text-xs font-normal text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" />
                              </td>
                              <td className="px-1.5 py-1.5 align-middle">
                                <NumericTextInput maxDecimals={2} value={batch.mrp} onValueChange={(mrp) => updateBatchDraft(batch.key, { mrp })} onFocus={() => { lastFocusedBatchFieldRef.current = "mrp"; }} onKeyDown={handleBatchGridNavigation} data-batch-field="mrp" aria-label={`MRP for batch ${index + 1}`} className="h-8 w-full rounded border border-outline-variant bg-white px-2 text-xs font-normal text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" />
                              </td>
                              <td className="px-1.5 py-1.5 align-middle">
                                <div className="flex justify-center">
                                  <input type="radio" name="default-selling-rate" checked={isDefault} disabled={Number(batch.quantity) <= 0} onChange={() => setDefaultBatchKey(batch.key)} aria-label={`Use batch ${index + 1} as the product listing default`} className="accent-primary" />
                                </div>
                              </td>
                              <td className="px-1.5 py-1.5 align-middle">
                                <div className="flex flex-col items-center gap-1">
                                  <button type="button" disabled={!batch.isNew} onClick={() => batch.isNew && removeBatchDraft(batch.key)} title={batch.isNew ? "Remove this unsaved batch" : "Existing stock batches are retained to preserve inventory history"} aria-label={`Remove batch ${index + 1}`} className="rounded p-1 text-error transition hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-40">
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t border-outline-variant/40 bg-surface-container-low">
                        <tr>
                          <th className="px-2 py-2.5 text-left font-label-md text-label-md font-semibold text-on-surface">Total</th>
                          <th className="px-1.5 py-2.5 font-data-mono-md text-data-mono-md font-semibold text-on-surface">{batchStockTotal.toLocaleString()} {selectedUnit?.symbol || selectedUnit?.name || productBeingEdited?.unit || "units"}</th>
                          <th colSpan={5} className="px-2 py-2.5" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" data-add-batch onKeyDown={handleBatchGridNavigation} onClick={addAnotherBatch} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-surface-container-lowest px-3 text-sm font-semibold text-primary transition hover:bg-primary-container/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"><span className="material-symbols-outlined text-[17px]">add</span>Add New Batch</button>
                  {drawerMode === "edit" && !isAdmin && <span className="text-[11px] text-on-surface-variant">Only Admin users can change batch quantities or add stock.</span>}
                </div>
                {drawerMode === "edit" && !batchDrafts.length && <p className="mt-2 text-[11px] text-on-surface-variant">No active stock batches are available. Add a batch to receive stock.</p>}
                {drawerMode === "edit" && batchDrafts.length > 0 && <label className="mt-3 flex items-center gap-2 border-t border-outline-variant/30 pt-3 text-xs font-medium text-on-surface"><input type="radio" name="default-selling-rate" checked={!defaultBatchKey} onChange={() => setDefaultBatchKey("")} className="accent-primary" />Keep existing product listing default ({formatCurrency(productBeingEdited?.sellingPrice || 0)})</label>}
              </section>
              </div>

              {/* Form Action Buttons */}
              <div className="flex shrink-0 items-center justify-end gap-space-sm border-t border-outline-variant/20 bg-white px-3 py-2.5 sm:px-6">
                <button
                  className="h-9 rounded border border-outline-variant/50 bg-surface-container-lowest px-space-md font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
                  onClick={() => setDrawerOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-9 min-w-[210px] items-center justify-center gap-1.5 whitespace-nowrap rounded bg-primary-container px-space-lg font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
                  type="submit"
                  data-product-submit
                  data-product-form-field="save"
                  disabled={formSaving}
                  aria-busy={formSaving}
                  onKeyDown={handleBatchGridNavigation}
                >
                  {formSaving ? (
                    <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                  <span>{formSaving ? (drawerMode === "edit" ? "Updating Product..." : "Adding Product...") : drawerMode === "edit" && pendingRetryAvailable ? "Confirm Previous Update" : drawerMode === "edit" ? "Update Product" : "Add Product"}</span>
                </button>
              </div>
            </form>

            {catalogModal && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!catalogSaving) setCatalogModal(null);
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="catalog-modal-title"
                  className="w-full max-w-sm rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-space-lg shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-space-md">
                    <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                      Product catalog
                    </p>
                    <h3
                      id="catalog-modal-title"
                      className="mt-1 text-lg font-semibold text-on-surface"
                    >
                      Add {catalogModal}
                    </h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      This will be saved to your catalog for future products.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">
                    Brand name
                    <input
                      autoFocus
                      value={catalogName}
                      onChange={(event) => setCatalogName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveCatalogOption();
                        }
                      }}
                      placeholder="e.g. Castrol"
                      className="h-10 rounded-md border border-outline-variant/50 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                  <div className="mt-space-lg flex justify-end gap-space-sm border-t border-outline-variant/20 pt-space-md">
                    <button
                      type="button"
                      disabled={catalogSaving}
                      onClick={() => setCatalogModal(null)}
                      className="h-9 rounded-md border border-outline-variant/40 px-4 text-sm text-on-surface disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={catalogSaving}
                      onClick={() => void saveCatalogOption()}
                      className="h-9 rounded-md bg-primary-container px-4 text-sm font-semibold text-on-primary disabled:opacity-60"
                    >
                      {catalogSaving ? "Saving…" : `Save ${catalogModal}`}
                    </button>
                  </div>
                </section>
              </div>
            )}
            {unitManagerOpen && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setUnitManagerOpen(false);
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="unit-manager-title"
                  className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3
                        id="unit-manager-title"
                        className="text-lg font-semibold text-on-surface"
                      >
                        Manage units
                      </h3>
                      <p className="text-sm text-on-surface-variant">
                        Rename units without changing product references.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnitManagerOpen(false)}
                      aria-label="Close"
                      className="rounded px-2 py-1 text-on-surface-variant hover:bg-surface-container-low"
                    >
                      ✕
                    </button>
                  </div>
                  <ul className="mt-4 max-h-72 divide-y divide-outline-variant/20 overflow-y-auto">
                    {units.map((unit) => (
                      <li
                        key={unit.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="text-on-surface">
                          {unit.name}
                          {unit.symbol ? ` (${unit.symbol})` : ""}
                          {unit.allowsDecimals ? " · decimals" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUnit(unit);
                            setUnitEditorOpen(true);
                          }}
                          className="rounded px-3 py-1 text-primary hover:bg-primary/10"
                        >
                          Edit
                        </button>
                      </li>
                    ))}
                    {!units.length && (
                      <li className="py-5 text-center text-sm text-on-surface-variant">
                        No units found.
                      </li>
                    )}
                  </ul>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setUnitManagerOpen(false)}
                      className="h-9 rounded-md border border-outline-variant/40 px-4 text-sm text-on-surface"
                    >
                      Done
                    </button>
                  </div>
                </section>
              </div>
            )}
            {unitEditorOpen && (
              <UnitEditorModal
                key={editingUnit?.id || "new-unit"}
                units={units}
                unit={editingUnit}
                onSave={saveUnit}
                onClose={() => {
                  setUnitEditorOpen(false);
                  setEditingUnit(undefined);
                }}
              />
            )}
          </div>
        </div>
      )}
      {batchStockInfoOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4"
          onClick={() => setBatchStockInfoOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-stock-info-title"
            className="w-full max-w-sm rounded-xl border border-outline-variant/30 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-[20px] text-primary">info</span>
              <div>
                <h2 id="batch-stock-info-title" className="font-label-lg text-label-lg font-semibold text-on-surface">
                  Batch limits
                </h2>
                <p className="mt-2 font-label-sm text-label-sm font-semibold text-on-surface">You can’t</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 font-body-sm text-body-sm text-on-surface-variant">
                  <li>Increase an existing batch’s quantity.</li>
                  <li>Change its purchase price or delete the batch.</li>
                </ul>
                <p className="mt-3 font-label-sm text-label-sm font-semibold text-on-surface">You can</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 font-body-sm text-body-sm text-on-surface-variant">
                  <li>Change its selling price and MRP.</li>
                  <li>As Admin, reduce stock or add a new batch.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setBatchStockInfoOpen(false)}
                className="h-8 rounded-md bg-primary-container px-4 font-label-md text-label-md font-semibold text-on-primary"
              >
                Got it
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
