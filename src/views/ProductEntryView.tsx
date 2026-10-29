import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { formatCurrency } from '../utils/currency';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const ProductEntryView: React.FC = () => {
  const { authSession, products, brands, units, createBrand, createUnit, addProduct, updateProduct, adjustProductStock, deleteProduct, masterDataLoading, masterDataError, catalogLoading, catalogError, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formQty, setFormQty] = useState('0');
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formMRP, setFormMRP] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [catalogModal, setCatalogModal] = useState<'brand' | 'unit' | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [catalogSymbol, setCatalogSymbol] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);

  // Filtering
  const filteredProducts = products.filter((p) => {
    if (p.status !== 'Active') return false;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q);

    const matchesBrand = brandFilter === 'all' || p.brand.toLowerCase() === brandFilter.toLowerCase();

    let matchesStock = true;
    if (stockFilter === 'in_stock') matchesStock = p.quantity > (p.minThreshold || 10);
    if (stockFilter === 'low_stock') matchesStock = p.quantity <= (p.minThreshold || 10);

    return matchesSearch && matchesBrand && matchesStock;
  });
  const brandNames = Array.from(new Set(products.map((product) => product.brand).filter(Boolean)));
  const productBeingEdited = drawerMode === 'edit' ? products.find((product) => product.id === editingId) : undefined;
  const isAdmin = authSession?.user.role === 'ADMIN';
  const quantityChanged = Boolean(productBeingEdited && Number(formQty) !== productBeingEdited.quantity);

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setEditingId(null);
    setFormName('');
    setFormBrandId('');
    setFormUnitId('');
    setFormQty('0');
    setStockAdjustmentReason('');
    setFormSellingPrice('');
    setFormMRP('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (product: Product) => {
    setDrawerMode('edit');
    setEditingId(product.id);
    setFormName(product.name);
    const productBrand = brands.find((brand) => brand.id === product.brandId || brand.name === product.brand);
    const productUnit = units.find((unit) => unit.id === product.unitId || unit.symbol === product.unit || unit.name === product.unit);
    setFormBrandId(product.brandId || productBrand?.id || '');
    setFormUnitId(product.unitId || productUnit?.id || '');
    setFormQty(product.quantity.toString());
    setStockAdjustmentReason('');
    setFormSellingPrice(product.sellingPrice.toString());
    setFormMRP(product.mrp.toString());
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sp = parseFloat(formSellingPrice);
    const mrp = parseFloat(formMRP);
    const qty = Number(formQty);
    if (!formName.trim() || !formBrandId || !formUnitId || !Number.isFinite(sp) || !Number.isFinite(mrp) || !Number.isFinite(qty) || qty < 0) {
      showToast('Please fill out all required fields with valid values.', 'error');
      return;
    }
    if (!isUuid(formBrandId) || !isUuid(formUnitId)) {
      showToast('Choose a brand and unit with valid IDs from the API list, then try again.', 'error');
      return;
    }
    if (drawerMode === 'edit' && quantityChanged && !isAdmin) {
      showToast('Only Admin users can change stock quantity.', 'error');
      return;
    }
    if (drawerMode === 'edit' && quantityChanged && !stockAdjustmentReason.trim()) {
      showToast('Enter a reason for changing the stock quantity.', 'error');
      return;
    }

    setFormSaving(true);
    try {
      const payload = { name: formName.trim(), brandId: formBrandId, unitId: formUnitId, sellingPrice: sp, mrp };
      if (drawerMode === 'create') await addProduct({ ...payload, qty });
      else if (editingId) {
        await updateProduct(editingId, payload);
        if (quantityChanged) {
          try {
            await adjustProductStock(editingId, qty, stockAdjustmentReason);
          } catch (error) {
            throw new Error(`Product details were saved, but stock was not confirmed: ${error instanceof Error ? error.message : 'stock adjustment failed.'}`);
          }
        }
      }
      setDrawerOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save the product.', 'error');
    } finally {
      setFormSaving(false);
    }
  };

  const openCatalogModal = (kind: 'brand' | 'unit') => {
    setCatalogModal(kind);
    setCatalogName('');
    setCatalogSymbol('');
  };

  const saveCatalogOption = async () => {
    const name = catalogName.trim();
    const symbol = catalogSymbol.trim();
    if (!name || (catalogModal === 'unit' && !symbol)) {
      showToast(catalogModal === 'unit' ? 'Enter both a unit name and symbol.' : 'Enter a brand name.', 'error');
      return;
    }

    setCatalogSaving(true);
    try {
      if (catalogModal === 'brand') {
        const brand = await createBrand(name);
        setFormBrandId(brand.id);
      } else if (catalogModal === 'unit') {
        const unit = await createUnit(name, symbol);
        setFormUnitId(unit.id);
      }
      setCatalogModal(null);
      setCatalogName('');
      setCatalogSymbol('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Unable to add the ${catalogModal || 'option'}.`, 'error');
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from the billing catalog?`)) {
      try {
        await deleteProduct(id);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to deactivate the product.', 'error');
      }
    }
  };

  const handleExportCatalog = () => {
    const csvRows = [
      ['Product Name', 'Brand', 'Selling Price (INR)', 'MRP (INR)', 'Current Stock', 'Status'],
      ...products.filter((product) => product.status === 'Active').map((p) => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.brand,
        formatCurrency(p.sellingPrice),
        formatCurrency(p.mrp),
        p.quantity.toString(),
        p.status,
      ]),
    ];
    const csvContent = csvRows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Catalog_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Catalog exported to CSV successfully.');
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-8 font-semibold tracking-tight text-on-surface">Products</h1>
          <p className="text-sm text-on-surface-variant">Add and manage shop products.</p>
        </div>
        <button className="h-9 px-4 rounded-md bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold flex items-center gap-2 shadow-sm" onClick={openCreateDrawer} type="button">
          <span className="material-symbols-outlined text-[18px]">add</span><span>Add Product</span>
        </button>
      </div>
      {masterDataError && <div role="alert" className="rounded-lg border border-error/30 bg-error-container/50 px-3 py-2 text-sm text-error">{masterDataError}</div>}
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
          <label className="relative sm:w-36 shrink-0 flex flex-col gap-1 text-[11px] font-medium text-on-surface-variant">Brand
            <select
              className="w-full h-8 pl-space-sm pr-8 bg-surface-container-low text-on-surface font-body-md text-body-md rounded appearance-none focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary cursor-pointer"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="all">All Brands</option>
              {brandNames.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-2 top-[27px] -translate-y-1/2 text-outline text-[16px] pointer-events-none">
              expand_more
            </span>
          </label>

          {/* Stock Status Filter */}
          <label className="relative sm:w-32 shrink-0 flex flex-col gap-1 text-[11px] font-medium text-on-surface-variant">Stock
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

        {/* Right Utility: Bulk counter & clear */}
        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2 text-on-surface-variant font-label-md text-label-md shrink-0">
          <span className="font-data-mono-sm text-data-mono-sm bg-surface-container-low px-2 py-1 rounded whitespace-nowrap">
            Filtered: {filteredProducts.length} / {products.length} products
          </span>
          <button
            className="hover:text-primary transition-colors text-outline px-1"
            onClick={() => {
              setSearchTerm('');
              setBrandFilter('all');
              setStockFilter('all');
            }}
            type="button"
          >
            Reset
          </button>
          <span className="hidden xl:block h-6 w-px bg-outline-variant/60 mx-1" />
          <button className="h-8 px-3 rounded border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md flex items-center gap-1 transition-colors whitespace-nowrap" type="button" onClick={handleExportCatalog}>
            <span className="material-symbols-outlined text-[16px]">file_download</span><span>Export</span>
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
              {masterDataLoading && <tr><td colSpan={6} className="p-8 text-center text-on-surface-variant">Loading products from API…</td></tr>}
              {!masterDataLoading && filteredProducts.map((p, idx) => {
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-surface-container-low transition-colors group ${
                      idx % 2 === 1 ? 'bg-surface-container-lowest/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-space-md min-w-[240px]">
                      <div className="flex flex-col">
                        <span className="font-title-md text-body-md font-medium text-on-surface">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-space-md font-body-md text-body-md text-on-surface whitespace-nowrap">
                      <span className="bg-surface-container px-2 py-0.5 rounded font-label-sm text-label-sm text-on-surface-variant">
                        {p.brand || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-space-md font-data-mono-md text-data-mono-md text-on-surface text-right font-semibold whitespace-nowrap">
                      {formatCurrency(p.sellingPrice)}
                    </td>
                    <td className="py-2.5 px-space-md font-data-mono-md text-data-mono-md text-on-surface-variant text-right whitespace-nowrap">
                      {formatCurrency(p.mrp)}
                    </td>
                    <td className="py-2.5 px-space-md text-center whitespace-nowrap">
                      <span className="font-data-mono-md text-data-mono-md font-medium text-on-surface">{p.quantity}</span>
                    </td>
                    <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                          onClick={() => openEditDrawer(p)}
                          title="Edit Product"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors"
                          onClick={() => void handleDelete(p.id, p.name)}
                          title="Deactivate Product"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!masterDataLoading && !filteredProducts.length && <tr><td colSpan={6} className="p-8 text-center text-on-surface-variant">{masterDataError ? 'Products could not be loaded.' : 'No products match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Controls */}
        <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm font-label-md text-label-md text-on-surface-variant border-t border-outline-variant/20">
          <div className="flex items-center gap-space-xs">
            <span className="font-data-mono-sm text-data-mono-sm">
              Showing <strong className="text-on-surface font-semibold">1-{filteredProducts.length}</strong> of{' '}
              <strong className="text-on-surface font-semibold">{products.length}</strong> products
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="h-8 px-2.5 rounded bg-surface-container-lowest text-outline hover:text-on-surface transition-colors flex items-center justify-center disabled:opacity-40"
              disabled
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              <span className="hidden sm:inline ml-1 font-body-sm text-body-sm">Previous</span>
            </button>
            <button
              className="h-8 w-8 rounded bg-primary-container text-on-primary font-data-mono-sm text-data-mono-sm font-semibold"
              type="button"
            >
              1
            </button>
            <button
              className="h-8 w-8 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container font-data-mono-sm text-data-mono-sm transition-colors"
              type="button"
            >
              2
            </button>
            <button
              className="h-8 w-8 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container font-data-mono-sm text-data-mono-sm transition-colors"
              type="button"
            >
              3
            </button>
            <span className="px-1 text-outline font-data-mono-sm text-data-mono-sm">...</span>
            <button
              className="h-8 w-8 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container font-data-mono-sm text-data-mono-sm transition-colors"
              type="button"
            >
              8
            </button>
            <button
              className="h-8 px-2.5 rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center"
              type="button"
            >
              <span className="hidden sm:inline mr-1 font-body-sm text-body-sm">Next</span>
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Over Drawer for Add / Edit Product */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 flex justify-end"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest h-full shadow-2xl flex flex-col p-space-xl overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-space-md border-b border-outline-variant/20">
              <div className="flex flex-col">
                <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant uppercase tracking-wider">
                  RECORD FORM
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  {drawerMode === 'create' ? 'Add New Product' : 'Edit Product Details'}
                </h2>
              </div>
              <button
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                onClick={() => setDrawerOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Add/Edit Product Form */}
            <form className="flex flex-col gap-space-md mt-space-sm flex-1" onSubmit={handleFormSubmit}>
              {/* Product Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between">
                  <span>Product Name</span>
                  <span className="text-error font-data-mono-sm text-data-mono-sm">*Required</span>
                </label>
                <input
                  className="h-8 px-space-sm bg-surface-container-low text-on-surface font-body-md text-body-md rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary placeholder:text-outline"
                  placeholder="e.g., Engine Oil 5W-30 Synthetic"
                  required
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {catalogError && <p role="alert" className="rounded-md bg-error-container px-3 py-2 text-xs text-on-error-container">Brand and unit options could not be loaded: {catalogError}</p>}
              <div className="grid grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1.5 text-[12px] font-medium text-on-surface">
                  <label>Brand
                    <select required value={formBrandId} onChange={(e) => setFormBrandId(e.target.value)} disabled={catalogLoading} className="mt-1.5 h-8 w-full px-2 bg-surface-container-low border border-outline-variant rounded text-on-surface font-normal">
                      <option value="">{catalogLoading ? 'Loading brands…' : 'Select brand'}</option>
                      {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                    </select>
                  </label>
                  <button type="button" className="self-start text-primary text-xs" onClick={() => openCatalogModal('brand')}>+ Add brand</button>
                </div>
                <div className="flex flex-col gap-1.5 text-[12px] font-medium text-on-surface">
                  <label>Unit
                    <select required value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)} disabled={catalogLoading} className="mt-1.5 h-8 w-full px-2 bg-surface-container-low border border-outline-variant rounded text-on-surface font-normal">
                      <option value="">{catalogLoading ? 'Loading units…' : 'Select unit'}</option>
                      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ''}</option>)}
                    </select>
                  </label>
                  <button type="button" className="self-start text-primary text-xs" onClick={() => openCatalogModal('unit')}>+ Add unit</button>
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-on-surface">Qty
                <input required type="number" min="0" step="0.001" value={formQty} onChange={(e) => setFormQty(e.target.value)} readOnly={drawerMode === 'edit' && !isAdmin} className="h-8 px-2 bg-surface-container-low border border-outline-variant rounded text-on-surface font-normal read-only:opacity-70" />
                {drawerMode === 'edit' && !isAdmin && <span className="text-[11px] font-normal text-on-surface-variant">Only Admin users can adjust stock.</span>}
              </label>
              {drawerMode === 'edit' && isAdmin && quantityChanged && <label className="flex flex-col gap-1.5 text-[12px] font-medium text-on-surface">Stock adjustment reason
                <input required value={stockAdjustmentReason} onChange={(e) => setStockAdjustmentReason(e.target.value)} placeholder="e.g. Physical stock count correction" className="h-8 px-2 bg-surface-container-low border border-outline-variant rounded text-on-surface font-normal" />
              </label>}
              {/* Prices Row */}
              <div className="grid grid-cols-2 gap-space-md">
                {/* Selling Price */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between">
                    <span>Selling Price</span>
                    <span className="text-error font-data-mono-sm text-data-mono-sm">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-data-mono-md text-data-mono-md text-outline">
                      ₹
                    </span>
                    <input
                      className="w-full h-8 pl-6 pr-space-sm bg-surface-container-low text-on-surface font-data-mono-md text-data-mono-md rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary placeholder:text-outline"
                      min="0"
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={formSellingPrice}
                      onChange={(e) => setFormSellingPrice(e.target.value)}
                    />
                  </div>
                </div>

                {/* MRP */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between">
                    <span>MRP</span>
                    <span className="text-error font-data-mono-sm text-data-mono-sm">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-data-mono-md text-data-mono-md text-outline">
                      ₹
                    </span>
                    <input
                      className="w-full h-8 pl-6 pr-space-sm bg-surface-container-low text-on-surface font-data-mono-md text-data-mono-md rounded focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary placeholder:text-outline"
                      min="0"
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={formMRP}
                      onChange={(e) => setFormMRP(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="mt-auto pt-space-lg flex items-center justify-end gap-space-sm border-t border-outline-variant/20">
                <button
                  className="h-8 px-space-md rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors"
                  onClick={() => setDrawerOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-8 px-space-lg rounded bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md font-semibold transition-colors shadow-sm flex items-center gap-1 disabled:opacity-60"
                  type="submit"
                  disabled={formSaving}
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>{formSaving ? 'Saving…' : 'Save Product'}</span>
                </button>
              </div>
            </form>

            {catalogModal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={(event) => { event.stopPropagation(); if (!catalogSaving) setCatalogModal(null); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title" className="w-full max-w-sm rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-space-lg shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="mb-space-md">
                  <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Product catalog</p>
                  <h3 id="catalog-modal-title" className="mt-1 text-lg font-semibold text-on-surface">Add {catalogModal}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">This will be saved to your catalog for future products.</p>
                </div>
                <div className="flex flex-col gap-space-sm">
                  <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">{catalogModal === 'brand' ? 'Brand name' : 'Unit name'}
                    <input autoFocus value={catalogName} onChange={(event) => setCatalogName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveCatalogOption(); } }} placeholder={catalogModal === 'brand' ? 'e.g. Castrol' : 'e.g. Litre'} className="h-10 rounded-md border border-outline-variant/50 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </label>
                  {catalogModal === 'unit' && <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">Unit symbol
                    <input value={catalogSymbol} onChange={(event) => setCatalogSymbol(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveCatalogOption(); } }} placeholder="e.g. L" className="h-10 rounded-md border border-outline-variant/50 bg-surface-container-low px-3 text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </label>}
                </div>
                <div className="mt-space-lg flex justify-end gap-space-sm border-t border-outline-variant/20 pt-space-md">
                  <button type="button" disabled={catalogSaving} onClick={() => setCatalogModal(null)} className="h-9 rounded-md border border-outline-variant/40 px-4 text-sm text-on-surface disabled:opacity-50">Cancel</button>
                  <button type="button" disabled={catalogSaving} onClick={() => void saveCatalogOption()} className="h-9 rounded-md bg-primary-container px-4 text-sm font-semibold text-on-primary disabled:opacity-60">{catalogSaving ? 'Saving…' : `Save ${catalogModal}`}</button>
                </div>
              </section>
            </div>}
          </div>
        </div>
      )}

    </div>
  );
};
