import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  NavScreen,
  Product,
  SaleRecord,
  CreditBill,
  Expense,
  PurchaseBill,
  PartyLedgerEntry,
  Party,
} from '../types';
import {
  INITIAL_SALES,
  INITIAL_CREDIT_BILLS,
  INITIAL_EXPENSES,
  INITIAL_PURCHASES,
  INITIAL_PARTY_LEDGER,
  INITIAL_SUPPLIER_LEDGER,
} from '../data/initialData';
import {
  ApiProduct,
  ApiCustomer,
  ApiBrand,
  ApiUnit,
  ApiSupplier,
  AUTH_SESSION_KEY,
  AuthSession,
  CreateProductPayload,
  StockAdjustmentPayload,
  SupplierPayload,
  createCustomerRequest,
  createBrandRequest,
  createUnitRequest,
  createProductRequest,
  createStockAdjustmentRequest,
  createSaleRequest,
  createPurchaseRequest,
  createSupplierPaymentRequest,
  cancelPurchaseRequest,
  createSupplierRequest,
  getBrands,
  getCustomers,
  getProducts,
  getProductRequest,
  getSuppliers,
  getUnits,
  loginRequest,
  ProductPayload,
  CreateSalePayload,
  CreatePurchasePayload,
  PaymentMethod,
  CustomerPayload,
  updateCustomerRequest,
  updateProductRequest,
  updateSupplierRequest,
  UserRole,
} from '../services/api';
import { formatCurrency } from '../utils/currency';

const toPaymentMethodLabel = (method: PaymentMethod) => ({
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
})[method];

const DEMO_STORAGE_PREFIX = 'able_lubes_demo_v1_';
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const loadAuthSession = (): AuthSession | null => {
  try {
    const saved = localStorage.getItem(AUTH_SESSION_KEY);
    if (saved) return JSON.parse(saved) as AuthSession;

    // Migrate sessions created before persistent login was enabled.
    const previousTabSession = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!previousTabSession) return null;
    localStorage.setItem(AUTH_SESSION_KEY, previousTabSession);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return JSON.parse(previousTabSession) as AuthSession;
  } catch {
    return null;
  }
};

const loadDemoData = <T,>(key: string, initial: T): T => {
  try {
    const value = localStorage.getItem(DEMO_STORAGE_PREFIX + key);
    return value ? JSON.parse(value) as T : initial;
  } catch {
    return initial;
  }
};

const mapProduct = (product: ApiProduct): Product => ({
  id: product.id,
  name: product.name,
  sku: product.sku || '',
  brandId: product.brandId || (typeof product.brand === 'object' ? product.brand?.id : undefined),
  unitId: product.unitId || (typeof product.unit === 'object' ? product.unit?.id : undefined),
  hsn: '',
  brand: typeof product.brand === 'string' ? product.brand : product.brand?.name || product.brandName || '',
  unit: typeof product.unit === 'string' ? product.unit : product.unit?.symbol || product.unit?.name || product.unitName || '',
  sellingPrice: Number(product.sellingPrice),
  purchaseRate: 0,
  mrp: Number(product.mrp),
  quantity: Number(product.currentStock),
  status: product.active === false ? 'Inactive' : 'Active',
  minThreshold: 10,
});

const mapCustomer = (customer: ApiCustomer): Party => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone || '',
  address: customer.address || '',
  active: customer.active !== false,
  type: 'customer',
});

const mapSupplier = (supplier: ApiSupplier): Party => ({
  id: supplier.id,
  name: supplier.name,
  phone: supplier.phone || '',
  address: supplier.address || '',
  active: supplier.active !== false,
  type: 'supplier',
});

interface ToastInfo {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error';
}

interface AppContextType {
  authSession: AuthSession | null;
  login: (email: string, password: string, expectedRole: UserRole) => Promise<void>;
  logout: () => void;
  masterDataLoading: boolean;
  masterDataError: string | null;
  customerLoading: boolean;
  customerError: string | null;
  supplierLoading: boolean;
  supplierError: string | null;
  catalogLoading: boolean;
  catalogError: string | null;
  activeScreen: NavScreen;
  setActiveScreen: (screen: NavScreen) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  toast: ToastInfo | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  hideToast: () => void;

  // Products
  products: Product[];
  brands: ApiBrand[];
  units: ApiUnit[];
  createBrand: (name: string) => Promise<ApiBrand>;
  createUnit: (name: string, symbol: string) => Promise<ApiUnit>;
  addProduct: (product: CreateProductPayload) => Promise<void>;
  updateProduct: (id: string, updates: Partial<ProductPayload>) => Promise<void>;
  adjustProductStock: (id: string, quantity: number, reason: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Sales
  sales: SaleRecord[];
  addSale: (sale: Omit<SaleRecord, 'id'>) => Promise<boolean>;

  // Credit Bills
  creditBills: CreditBill[];
  addCreditBill: (bill: Omit<CreditBill, 'id'>) => void;
  collectCreditPayment: (billNumber: string, amount: number, paymentMethod: string) => void;

  // Expenses
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Purchase Bills
  purchases: PurchaseBill[];
  addPurchaseBill: (bill: Omit<PurchaseBill, 'id'>, paymentMethod: PaymentMethod) => Promise<boolean>;
  cancelPurchaseBill: (id: string) => Promise<boolean>;

  // Party Ledger
  partyLedger: PartyLedgerEntry[];
  customers: Party[];
  addCustomer: (customer: CustomerPayload) => Promise<void>;
  updateCustomer: (id: string, updates: Partial<CustomerPayload>) => Promise<void>;
  deactivateCustomer: (id: string) => Promise<void>;
  suppliers: Party[];
  addSupplier: (supplier: SupplierPayload) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<SupplierPayload>) => Promise<void>;
  deactivateSupplier: (id: string) => Promise<void>;
  supplierLedger: PartyLedgerEntry[];
  recordPartyPayment: (
    invoiceNumber: string,
    partyName: string,
    amount: number,
    paymentDate: string,
    paymentMode: string
  ) => void;
  recordSupplierPayment: (invoiceNumber: string, partyName: string, amount: number, paymentDate: string, paymentMode: string) => Promise<boolean>;

  // Quick Action Modals
  quickCollectTarget: { party: string; bill: string; amount: number } | null;
  setQuickCollectTarget: (target: { party: string; bill: string; amount: number } | null) => void;
  activeReceiptToPrint: {
    title: string;
    refNumber: string;
    date: string;
    party: string;
    items?: Array<{ name: string; qty: number; price: number; total: number }>;
    subtotal?: number;
    billDiscount?: number;
    total: number;
    mode: string;
  } | null;
  setActiveReceiptToPrint: (receipt: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authSession, setAuthSession] = useState<AuthSession | null>(loadAuthSession);
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [masterDataError, setMasterDataError] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<NavScreen>('dashboard');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  // Quick interactive targets
  const [quickCollectTarget, setQuickCollectTarget] = useState<{
    party: string;
    bill: string;
    amount: number;
  } | null>(null);

  const [activeReceiptToPrint, setActiveReceiptToPrint] = useState<any>(null);

  // Demo data is isolated under versioned keys so it can be replaced by the API adapter later.
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>(() => loadDemoData('sales', INITIAL_SALES));
  const [creditBills, setCreditBills] = useState<CreditBill[]>(() => loadDemoData('credit_bills', INITIAL_CREDIT_BILLS));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadDemoData('expenses', INITIAL_EXPENSES));
  const [purchases, setPurchases] = useState<PurchaseBill[]>(() => loadDemoData('purchases', INITIAL_PURCHASES));
  const [partyLedger, setPartyLedger] = useState<PartyLedgerEntry[]>(() => loadDemoData('customer_ledger', INITIAL_PARTY_LEDGER));
  const [supplierLedger, setSupplierLedger] = useState<PartyLedgerEntry[]>(() => loadDemoData('supplier_ledger', INITIAL_SUPPLIER_LEDGER));
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);

  // Clear the old browser-seeded product cache; Products now comes from the API.
  useEffect(() => {
    localStorage.removeItem(DEMO_STORAGE_PREFIX + 'products');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = authSession?.token;
    if (!token) {
      setMasterDataError(null);
      return;
    }

    setMasterDataLoading(true);
    setMasterDataError(null);
    getProducts(token).then((result) => {
      if (cancelled) return;
      setProducts(result.map(mapProduct));
      setMasterDataError(null);
    }).catch((error) => {
      if (!cancelled) setMasterDataError(error instanceof Error ? error.message : 'Products could not be loaded.');
    }).finally(() => {
      if (!cancelled) setMasterDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [authSession?.token]);

  useEffect(() => {
    let cancelled = false;
    const token = authSession?.token;
    if (!token) {
      setBrands([]);
      setUnits([]);
      setCatalogError(null);
      setCatalogLoading(false);
      return;
    }

    setCatalogLoading(true);
    setCatalogError(null);
    Promise.all([getBrands(token), getUnits(token)]).then(([brandRows, unitRows]) => {
      if (cancelled) return;
      setBrands(brandRows.filter((brand) => brand.active !== false && isUuid(brand.id)));
      setUnits(unitRows.filter((unit) => unit.active !== false && isUuid(unit.id)));
    }).catch((error) => {
      if (!cancelled) setCatalogError(error instanceof Error ? error.message : 'Brand and unit options could not be loaded.');
    }).finally(() => {
      if (!cancelled) setCatalogLoading(false);
    });

    return () => { cancelled = true; };
  }, [authSession?.token]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_PREFIX + 'sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_PREFIX + 'credit_bills', JSON.stringify(creditBills));
  }, [creditBills]);

  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_PREFIX + 'expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(DEMO_STORAGE_PREFIX + 'purchases', JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => { localStorage.setItem(DEMO_STORAGE_PREFIX + 'customer_ledger', JSON.stringify(partyLedger)); }, [partyLedger]);
  useEffect(() => { localStorage.setItem(DEMO_STORAGE_PREFIX + 'supplier_ledger', JSON.stringify(supplierLedger)); }, [supplierLedger]);
  useEffect(() => {
    // Discard old browser-seeded customer data; customer records now come from the API.
    localStorage.removeItem(DEMO_STORAGE_PREFIX + 'customers');
  }, []);

  useEffect(() => {
    localStorage.removeItem(DEMO_STORAGE_PREFIX + 'suppliers');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = authSession?.token;
    if (!token) {
      setCustomers([]);
      setCustomerError(null);
      setCustomerLoading(false);
      return;
    }

    setCustomerLoading(true);
    setCustomerError(null);
    getCustomers(token).then((result) => {
      if (!cancelled) setCustomers(result.map(mapCustomer).filter((customer) => customer.active !== false));
    }).catch((error) => {
      if (!cancelled) setCustomerError(error instanceof Error ? error.message : 'Customers could not be loaded.');
    }).finally(() => {
      if (!cancelled) setCustomerLoading(false);
    });

    return () => { cancelled = true; };
  }, [authSession?.token]);

  useEffect(() => {
    let cancelled = false;
    const token = authSession?.token;
    if (!token) {
      setSuppliers([]);
      setSupplierError(null);
      setSupplierLoading(false);
      return;
    }

    setSupplierLoading(true);
    setSupplierError(null);
    getSuppliers(token).then((result) => {
      if (!cancelled) setSuppliers(result.map(mapSupplier).filter((supplier) => supplier.active !== false));
    }).catch((error) => {
      if (!cancelled) setSupplierError(error instanceof Error ? error.message : 'Suppliers could not be loaded.');
    }).finally(() => {
      if (!cancelled) setSupplierLoading(false);
    });

    return () => { cancelled = true; };
  }, [authSession?.token]);


  // Global Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  const login = async (email: string, password: string, expectedRole: UserRole) => {
    const session = await loginRequest(email, password);
    if (!session.token || !session.user?.id || !session.user?.role) {
      throw new Error('The API returned incomplete login details.');
    }
    if (session.user.role !== expectedRole) {
      throw new Error(`This account is ${session.user.role === 'ADMIN' ? 'an Admin' : 'a Staff'} account. Select the matching account type.`);
    }
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    setAuthSession(session);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setAuthSession(null);
    setActiveScreen('dashboard');
  };

  // Product Actions
  const createBrand = async (name: string) => {
    if (!authSession) throw new Error('Sign in to add brands.');
    const existing = brands.find((brand) => brand.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing;
    const created = await createBrandRequest(authSession.token, name.trim());
    if (!isUuid(created.id)) throw new Error('The API created the brand but did not return a valid brand UUID.');
    setBrands((previous) => [created, ...previous]);
    showToast(`Brand "${created.name}" added.`);
    return created;
  };

  const createUnit = async (name: string, symbol: string) => {
    if (!authSession) throw new Error('Sign in to add units.');
    const existing = units.find((unit) => unit.name.trim().toLowerCase() === name.trim().toLowerCase() || unit.symbol?.trim().toLowerCase() === symbol.trim().toLowerCase());
    if (existing) return existing;
    const created = await createUnitRequest(authSession.token, name.trim(), symbol.trim());
    if (!isUuid(created.id)) throw new Error('The API created the unit but did not return a valid unit UUID.');
    setUnits((previous) => [created, ...previous]);
    showToast(`Unit "${created.name}" added.`);
    return created;
  };

  const addProduct = async (prodData: CreateProductPayload) => {
    if (!authSession) throw new Error('Sign in to add products.');
    const created = await createProductRequest(authSession.token, { ...prodData, active: true });
    const newProduct = mapProduct(created);
    setProducts((prev) => [newProduct, ...prev]);
    showToast(`Product "${newProduct.name}" added to catalog.`);
  };

  const updateProduct = async (id: string, updates: Partial<ProductPayload>) => {
    if (!authSession) throw new Error('Sign in to update products.');
    await updateProductRequest(authSession.token, id, updates);
    setProducts((prev) => prev.map((product) => product.id === id ? {
      ...product,
      ...updates,
      brand: updates.brandId ? brands.find((brand) => brand.id === updates.brandId)?.name || product.brand : product.brand,
      unit: updates.unitId ? (() => {
        const unit = units.find((candidate) => candidate.id === updates.unitId);
        return unit?.symbol || unit?.name || product.unit;
      })() : product.unit,
    } : product));
    showToast(`Product details updated successfully.`);
  };

  const adjustProductStock = async (id: string, desiredQuantity: number, reason: string) => {
    if (!authSession) throw new Error('Sign in to adjust product stock.');
    if (authSession.user.role !== 'ADMIN') throw new Error('Only Admin users can adjust product stock.');
    if (!Number.isFinite(desiredQuantity) || desiredQuantity < 0) throw new Error('Enter a valid non-negative quantity.');
    if (!reason.trim()) throw new Error('Enter a reason for changing the stock quantity.');

    const current = await getProductRequest(authSession.token, id);
    const currentQuantity = Number(current.currentStock);
    if (!Number.isFinite(currentQuantity)) throw new Error('The API returned an invalid current stock quantity.');
    const delta = desiredQuantity - currentQuantity;
    if (Math.abs(delta) < 0.0005) {
      setProducts((previous) => previous.map((product) => product.id === id ? { ...product, quantity: currentQuantity } : product));
      return;
    }

    const payload: StockAdjustmentPayload = {
      productId: id,
      quantity: Math.abs(delta),
      direction: delta > 0 ? 'IN' : 'OUT',
      reason: reason.trim(),
    };

    try {
      const adjustment = await createStockAdjustmentRequest(authSession.token, payload);
      const stockAfter = Number(adjustment.stockAfter);
      if (!Number.isFinite(stockAfter)) throw new Error('The API did not return the updated stock quantity.');
      setProducts((previous) => previous.map((product) => product.id === id ? { ...product, quantity: stockAfter } : product));
      showToast(`Stock quantity updated to ${stockAfter}.`);
    } catch (error) {
      // Refresh in case the server committed the adjustment but the response was lost.
      try {
        const latest = await getProductRequest(authSession.token, id);
        const latestQuantity = Number(latest.currentStock);
        if (Number.isFinite(latestQuantity)) {
          setProducts((previous) => previous.map((product) => product.id === id ? { ...product, quantity: latestQuantity } : product));
        }
      } catch {
        // Keep the original adjustment error for the form.
      }
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    if (!authSession) throw new Error('Sign in to deactivate products.');
    const target = products.find((p) => p.id === id);
    if (!target) return;
    await updateProductRequest(authSession.token, id, { active: false });
    setProducts((prev) => prev.map((product) => product.id === id ? { ...product, status: 'Inactive' } : product));
    showToast(`"${target.name}" was deactivated and removed from the active catalog.`, 'info');
  };

  const addCustomer = async (customerData: CustomerPayload) => {
    if (!authSession) throw new Error('Sign in to add customers.');
    const created = await createCustomerRequest(authSession.token, { ...customerData, active: true });
    const customer = mapCustomer(created);
    setCustomers((previous) => [customer, ...previous.filter((entry) => entry.id !== customer.id)]);
    showToast(`Customer "${customer.name}" added.`);
  };

  const updateCustomer = async (id: string, updates: Partial<CustomerPayload>) => {
    if (!authSession) throw new Error('Sign in to update customers.');
    const updated = await updateCustomerRequest(authSession.token, id, updates);
    const current = customers.find((entry) => entry.id === id);
    const customer = mapCustomer({
      ...updated,
      name: updated.name ?? current?.name ?? '',
      phone: updated.phone ?? current?.phone ?? '',
      address: updated.address ?? current?.address ?? '',
      active: updated.active ?? current?.active ?? true,
    });
    setCustomers((previous) => previous.map((entry) => entry.id === id ? customer : entry));
    showToast(`Customer "${customer.name}" updated.`);
  };

  const deactivateCustomer = async (id: string) => {
    if (!authSession) throw new Error('Sign in to deactivate customers.');
    const customer = customers.find((entry) => entry.id === id);
    if (!customer) return;
    await updateCustomerRequest(authSession.token, id, { active: false });
    setCustomers((previous) => previous.filter((entry) => entry.id !== id));
    showToast(`Customer "${customer.name}" deactivated.`);
  };

  const addSupplier = async (supplierData: SupplierPayload) => {
    if (!authSession) throw new Error('Sign in to add suppliers.');
    const created = await createSupplierRequest(authSession.token, { ...supplierData, active: true });
    const supplier = mapSupplier(created);
    setSuppliers((previous) => [supplier, ...previous.filter((entry) => entry.id !== supplier.id)]);
    showToast(`Supplier "${supplier.name}" added.`);
  };

  const updateSupplier = async (id: string, updates: Partial<SupplierPayload>) => {
    if (!authSession) throw new Error('Sign in to update suppliers.');
    const updated = await updateSupplierRequest(authSession.token, id, updates);
    const current = suppliers.find((entry) => entry.id === id);
    const supplier = mapSupplier({
      ...updated,
      name: updated.name ?? current?.name ?? '',
      phone: updated.phone ?? current?.phone ?? '',
      address: updated.address ?? current?.address ?? '',
      active: updated.active ?? current?.active ?? true,
    });
    setSuppliers((previous) => previous.map((entry) => entry.id === id ? supplier : entry));
    showToast(`Supplier "${supplier.name}" updated.`);
  };

  const deactivateSupplier = async (id: string) => {
    if (!authSession) throw new Error('Sign in to deactivate suppliers.');
    const supplier = suppliers.find((entry) => entry.id === id);
    if (!supplier) return;
    await updateSupplierRequest(authSession.token, id, { active: false });
    setSuppliers((previous) => previous.filter((entry) => entry.id !== id));
    showToast(`Supplier "${supplier.name}" deactivated.`);
  };

  // Sales Actions
  const addSale = async (saleData: Omit<SaleRecord, 'id'>): Promise<boolean> => {
    if (!authSession) {
      showToast('Sign in before completing a sale.', 'error');
      return false;
    }
    const requested = saleData.lineItems || [];
    if (!requested.length) {
      showToast('Add at least one catalog product to the bill.', 'error');
      return false;
    }
    const quantityByProduct = requested.reduce<Record<string, number>>((totals, item) => {
      totals[item.productId] = (totals[item.productId] || 0) + item.quantity;
      return totals;
    }, {});
    const unavailable = Object.entries(quantityByProduct).find(([id, qty]) => {
      const product = products.find((candidate) => candidate.id === id);
      return !product || product.status !== 'Active' || product.quantity < qty;
    });
    if (unavailable) {
      const product = products.find((candidate) => candidate.id === unavailable[0]);
      showToast(product ? `Not enough stock for ${product.name}. Available: ${product.quantity}.` : 'A selected product is no longer in the catalog.', 'error');
      return false;
    }
    if (saleData.paymentMode === 'Credit' && !saleData.customerName.trim()) {
      showToast('Select a customer for credit sales.', 'error');
      return false;
    }
    const customer = saleData.customerType === 'registered'
      ? customers.find((entry) => entry.name === saleData.customerName)
      : undefined;
    if (saleData.customerType === 'registered' && !customer) {
      showToast('Select a valid registered customer before completing this sale.', 'error');
      return false;
    }
    const payload: CreateSalePayload = {
      ...(customer ? { customerId: customer.id } : {}),
      discountAmount: saleData.billDiscountAmount || 0,
      items: requested.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        discountAmount: item.quantity * item.sellingPrice * (item.discount / 100),
      })),
    };

    let apiSale;
    try {
      apiSale = await createSaleRequest(authSession.token, payload);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The sale could not be saved.', 'error');
      return false;
    }

    const newSale: SaleRecord = {
      ...saleData,
      id: apiSale.id,
      amount: Number(apiSale.totalAmount),
      costOfGoodsSold: requested.reduce((sum, item) => sum + item.quantity * item.purchaseRate, 0),
    };
    setSales((prev) => [newSale, ...prev]);
    setProducts((prev) => prev.map((product) => {
      const qty = quantityByProduct[product.id];
      return qty ? { ...product, quantity: product.quantity - qty } : product;
    }));

    // If sale was made via Credit, add to credit bills and party ledger
    if (newSale.paymentMode === 'Credit') {
      const priorBalance = creditBills.filter((bill) => bill.partyName === newSale.customerName).reduce((sum, bill) => sum + bill.netDue, 0);
      const newCreditBill: CreditBill = {
        id: 'cr-' + Date.now(),
        billDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        billNumber: 'CR-' + newSale.billNumber,
        partyName: newSale.customerName,
        gstin: '',
        term: 'Due on agreed date',
        status: 'Unpaid',
        priorBalance,
        billAmount: newSale.amount,
        netDue: priorBalance + newSale.amount,
        dueDate: newSale.creditDueDate || new Date().toISOString().slice(0, 10),
        remarks: `Generated from Sales Bill ${newSale.billNumber}`,
      };
      setCreditBills((prev) => [newCreditBill, ...prev]);

      // Also append to party ledger
      const newLedgerEntry: PartyLedgerEntry = {
        id: 'pl-' + Date.now(),
        partyName: newSale.customerName,
        invoiceNumber: 'CR-' + newSale.billNumber,
        invoiceDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        billAmount: newSale.amount,
        paymentDate: '-',
        amountPaid: 0,
        outstandingBalance: priorBalance + newSale.amount,
        transactionType: 'INVOICES',
        partyType: 'customer',
      };
      setPartyLedger((prev) => [newLedgerEntry, ...prev]);
    }

    showToast(`Sale Bill ${newSale.billNumber} created successfully! (${formatCurrency(newSale.amount)})`);
    return true;
  };

  // Credit Bill Actions
  const addCreditBill = (billData: Omit<CreditBill, 'id'>) => {
    const newBill: CreditBill = {
      ...billData,
      id: 'cr-' + Date.now(),
    };
    setCreditBills((prev) => [newBill, ...prev]);

    // Append to party ledger
    const newLedgerEntry: PartyLedgerEntry = {
      id: 'pl-' + Date.now(),
      partyName: newBill.partyName,
      invoiceNumber: newBill.billNumber,
      invoiceDate: newBill.billDate,
      billAmount: newBill.billAmount,
      paymentDate: '-',
      amountPaid: 0,
      outstandingBalance: newBill.netDue,
      transactionType: 'INVOICES',
      partyType: 'customer',
    };
    setPartyLedger((prev) => [newLedgerEntry, ...prev]);

    showToast(`Credit Bill ${newBill.billNumber} recorded for ${newBill.partyName}.`);
  };

  const collectCreditPayment = (billNumber: string, amount: number, paymentMethod: string) => {
    const target = creditBills.find((bill) => bill.billNumber === billNumber);
    if (!target || amount <= 0 || amount > target.netDue) {
      showToast(target ? 'Receipt must be positive and cannot exceed the outstanding balance.' : 'Credit bill was not found.', 'error');
      return;
    }
    const newDue = target.netDue - amount;
    setCreditBills((prev) => prev.map((bill) => bill.id === target.id ? {
      ...bill,
      netDue: newDue,
      status: newDue === 0 ? 'Settled' : 'Partially Paid',
    } : bill));

    // Also update party ledger
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    setPartyLedger((prev) =>
      prev.map((pl) => {
        if (pl.invoiceNumber === billNumber && pl.partyType === 'customer' && pl.transactionType === 'INVOICES') {
          const newPaid = pl.amountPaid + amount;
          return {
            ...pl,
            paymentDate: today,
            amountPaid: newPaid,
            outstandingBalance: newDue,
            paymentMode: paymentMethod,
          };
        }
        return pl;
      })
    );

    setPartyLedger((prev) => [{
      id: `payment-${Date.now()}`,
      partyName: target.partyName,
      invoiceNumber: billNumber,
      invoiceDate: target.billDate,
      billAmount: 0,
      paymentDate: today,
      amountPaid: amount,
      outstandingBalance: newDue,
      transactionType: 'PAYMENTS',
      paymentMode: paymentMethod,
      partyType: 'customer',
    }, ...prev]);

    showToast(`Payment receipt of ${formatCurrency(amount)} recorded for bill ${billNumber} via ${paymentMethod}.`);
  };

  // Expense Actions
  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: 'exp-' + Date.now(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    showToast(`Expense of ${formatCurrency(newExpense.amount)} for "${newExpense.description}" logged.`);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    showToast(`Expense entry deleted.`, 'info');
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => prev.map((expense) => expense.id === id ? { ...expense, ...updates } : expense));
    showToast('Expense updated.');
  };

  // Purchase Bill Actions
  const addPurchaseBill = async (
    billData: Omit<PurchaseBill, 'id'>,
    paymentMethod: PaymentMethod,
  ): Promise<boolean> => {
    if (!authSession) {
      showToast('Sign in before recording a purchase.', 'error');
      return false;
    }
    const supplier = suppliers.find((entry) => entry.name === billData.partyName);
    if (!supplier) {
      showToast('Choose a valid supplier before recording this purchase.', 'error');
      return false;
    }
    const items = billData.items.filter((item) => item.productId && item.quantity > 0);
    if (!items.length || items.length !== billData.items.length) {
      showToast('Choose a catalog product and valid quantity for every purchase line.', 'error');
      return false;
    }

    const payload: CreatePurchasePayload = {
      supplierId: supplier.id,
      supplierInvoiceNumber: billData.invoiceNumber,
      discountAmount: 0,
      items: items.map((item) => ({
        productId: item.productId!,
        quantity: item.quantity,
        supplierRate: item.purchaseRate,
      })),
    };

    let apiPurchase;
    try {
      apiPurchase = await createPurchaseRequest(authSession.token, payload);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The purchase could not be saved.', 'error');
      return false;
    }

    const totalAmount = Number(apiPurchase.totalAmount);
    let amountPaid = 0;
    let paymentError: string | undefined;
    const requestedPayment = Math.max(0, Math.min(billData.amountPaid || 0, totalAmount));

    if (requestedPayment > 0) {
      try {
        await createSupplierPaymentRequest(authSession.token, {
          supplierId: supplier.id,
          purchaseId: apiPurchase.id,
          amount: requestedPayment,
          method: paymentMethod,
          notes: billData.remarks?.trim() || undefined,
        });
        amountPaid = requestedPayment;
      } catch (error) {
        paymentError = error instanceof Error ? error.message : 'The supplier payment could not be recorded.';
      }
    }

    const newPurchase: PurchaseBill = {
      ...billData,
      id: apiPurchase.id,
      status: amountPaid > 0 ? (amountPaid >= totalAmount ? 'PAID' : 'PARTIALLY_PAID') : apiPurchase.status || 'UNPAID',
      totalAmount,
      subtotal: totalAmount,
      amountPaid,
      outstandingBalance: Math.max(0, totalAmount - amountPaid),
      items: items.map((item) => ({ ...item, totalAmount: item.quantity * item.purchaseRate })),
    };
    setPurchases((prev) => [newPurchase, ...prev]);

    // The purchase endpoint increments stock. Refresh the API catalog after it confirms success.
    try {
      const refreshedProducts = await getProducts(authSession.token);
      setProducts(refreshedProducts.map(mapProduct));
    } catch {
      setProducts((prev) => prev.map((product) => {
        const receivedQty = items.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
        const purchaseRate = items.find((item) => item.productId === product.id)?.purchaseRate;
        return receivedQty ? { ...product, quantity: product.quantity + receivedQty, purchaseRate: purchaseRate || product.purchaseRate } : product;
      }));
    }

    setSupplierLedger((prev) => [
      ...(amountPaid > 0 ? [{
        id: `supplier-payment-${apiPurchase.id}`,
        partyName: newPurchase.partyName,
        invoiceNumber: newPurchase.invoiceNumber,
        invoiceDate: newPurchase.invoiceDate,
        billAmount: 0,
        paymentDate: newPurchase.invoiceDate,
        amountPaid,
        outstandingBalance: newPurchase.outstandingBalance || 0,
        transactionType: 'PAYMENTS' as const,
        paymentMode: toPaymentMethodLabel(paymentMethod),
        partyType: 'supplier' as const,
      }] : []),
      {
        id: `supplier-invoice-${apiPurchase.id}`,
        partyName: newPurchase.partyName,
        invoiceNumber: newPurchase.invoiceNumber,
        invoiceDate: newPurchase.invoiceDate,
        billAmount: totalAmount,
        paymentDate: amountPaid > 0 ? newPurchase.invoiceDate : '-',
        amountPaid,
        outstandingBalance: newPurchase.outstandingBalance || 0,
        transactionType: 'INVOICES' as const,
        partyType: 'supplier' as const,
      },
      ...prev,
    ]);

    if (paymentError) {
      showToast(`Purchase saved and stock updated, but the payment was not recorded: ${paymentError}`, 'error');
    } else {
      showToast(`Purchase invoice ${newPurchase.invoiceNumber} saved. Stock updated${amountPaid > 0 ? ' and payment recorded' : ''}.`);
    }
    return true;
  };

  const cancelPurchaseBill = async (id: string): Promise<boolean> => {
    if (!authSession) {
      showToast('Sign in before cancelling a purchase.', 'error');
      return false;
    }
    const purchase = purchases.find((entry) => entry.id === id);
    if (!purchase) {
      showToast('Purchase invoice was not found.', 'error');
      return false;
    }
    if (purchase.amountPaid && purchase.amountPaid > 0) {
      showToast('Only unpaid purchases can be cancelled.', 'error');
      return false;
    }
    try {
      await cancelPurchaseRequest(authSession.token, id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The purchase could not be cancelled.', 'error');
      return false;
    }

    setPurchases((previous) => previous.map((entry) => entry.id === id ? { ...entry, status: 'CANCELLED' } : entry));
    setSupplierLedger((previous) => previous.filter((entry) => entry.invoiceNumber !== purchase.invoiceNumber));
    try {
      const refreshedProducts = await getProducts(authSession.token);
      setProducts(refreshedProducts.map(mapProduct));
    } catch {
      setProducts((previous) => previous.map((product) => {
        const reversedQty = purchase.items.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
        return reversedQty ? { ...product, quantity: Math.max(0, product.quantity - reversedQty) } : product;
      }));
    }
    showToast(`Purchase invoice ${purchase.invoiceNumber} cancelled and stock reversed.`);
    return true;
  };

  // Party Ledger Actions
  const recordPartyPayment = (
    invoiceNumber: string,
    partyName: string,
    amount: number,
    paymentDate: string,
    paymentMode: string
  ) => {
    const target = partyLedger.find((entry) => entry.invoiceNumber === invoiceNumber && entry.partyType === 'customer' && entry.transactionType === 'INVOICES');
    const bill = creditBills.find((entry) => entry.billNumber === invoiceNumber);
    const due = bill?.netDue ?? target?.outstandingBalance ?? 0;
    if (!target || amount <= 0 || amount > due) {
      showToast(target ? 'Payment cannot exceed the outstanding balance.' : 'Customer invoice was not found.', 'error');
      return;
    }
    const outstanding = due - amount;
    setPartyLedger((prev) =>
      prev.map((entry) => {
        if (entry.invoiceNumber === invoiceNumber && entry.partyType === 'customer' && entry.transactionType === 'INVOICES') {
          const newPaid = entry.amountPaid + amount;
          return {
            ...entry,
            paymentDate,
            amountPaid: newPaid,
            outstandingBalance: outstanding,
            paymentMode,
          };
        }
        return entry;
      })
    );

    setPartyLedger((prev) => [{
      id: `payment-${Date.now()}`,
      partyName,
      invoiceNumber,
      invoiceDate: target.invoiceDate,
      billAmount: 0,
      paymentDate,
      amountPaid: amount,
      outstandingBalance: outstanding,
      transactionType: 'PAYMENTS',
      paymentMode,
      partyType: 'customer',
    }, ...prev]);

    // Also update credit bill if matching
    setCreditBills((prev) =>
      prev.map((cb) => {
        if (cb.billNumber === invoiceNumber && cb.partyName === partyName) {
          const newNetDue = Math.max(0, cb.netDue - amount);
          return {
            ...cb,
            netDue: newNetDue,
            status: newNetDue === 0 ? 'Settled' : 'Partially Paid',
          };
        }
        return cb;
      })
    );

    showToast(`Payment of ${formatCurrency(amount)} recorded for ${invoiceNumber}.`);
  };

  const recordSupplierPayment = async (invoiceNumber: string, partyName: string, amount: number, paymentDate: string, paymentMode: string): Promise<boolean> => {
    const purchase = purchases.find((entry) => entry.invoiceNumber === invoiceNumber && entry.partyName === partyName);
    const due = purchase?.outstandingBalance ?? 0;
    if (!purchase || amount <= 0 || amount > due) {
      showToast(purchase ? 'Payment cannot exceed the outstanding balance.' : 'Supplier invoice was not found.', 'error');
      return false;
    }
    if (!authSession || !isUuid(purchase.id)) {
      showToast('This invoice is not linked to a saved API purchase and cannot accept a backend payment.', 'error');
      return false;
    }
    const supplier = suppliers.find((entry) => entry.name === partyName);
    if (!supplier) {
      showToast('The supplier for this invoice is not available.', 'error');
      return false;
    }
    const methodMap: Record<string, PaymentMethod> = {
      Cash: 'CASH',
      UPI: 'UPI',
      'Bank transfer': 'BANK_TRANSFER',
      Cheque: 'CHEQUE',
    };
    const normalizedPaymentMethod = methodMap[paymentMode] || 'CASH';
    try {
      await createSupplierPaymentRequest(authSession.token, {
        supplierId: supplier.id,
        purchaseId: purchase.id,
        amount,
        method: normalizedPaymentMethod,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The supplier payment could not be saved.', 'error');
      return false;
    }
    const outstanding = due - amount;
    setPurchases((prev) => prev.map((entry) => entry.id === purchase.id ? {
      ...entry,
      status: outstanding === 0 ? 'PAID' : 'PARTIALLY_PAID',
      amountPaid: (entry.amountPaid || 0) + amount,
      outstandingBalance: outstanding,
    } : entry));
    setSupplierLedger((prev) => prev.map((entry) => entry.invoiceNumber === invoiceNumber && entry.transactionType === 'INVOICES' ? {
      ...entry,
      paymentDate,
      amountPaid: entry.amountPaid + amount,
      outstandingBalance: outstanding,
      paymentMode: toPaymentMethodLabel(normalizedPaymentMethod),
    } : entry));
    setSupplierLedger((prev) => [{
      id: `supplier-payment-${Date.now()}`,
      partyName,
      invoiceNumber,
      invoiceDate: purchase.invoiceDate,
      billAmount: 0,
      paymentDate,
      amountPaid: amount,
      outstandingBalance: outstanding,
      transactionType: 'PAYMENTS',
      paymentMode: toPaymentMethodLabel(normalizedPaymentMethod),
      partyType: 'supplier',
    }, ...prev]);
    showToast(`Supplier payment of ${formatCurrency(amount)} recorded for ${invoiceNumber}.`);
    return true;
  };

  return (
    <AppContext.Provider
      value={{
        authSession,
        login,
        logout,
        masterDataLoading,
        masterDataError,
        customerLoading,
        customerError,
        supplierLoading,
        supplierError,
        catalogLoading,
        catalogError,
        activeScreen,
        setActiveScreen,
        searchModalOpen,
        setSearchModalOpen,
        toast,
        showToast,
        hideToast,
        products,
        brands,
        units,
        createBrand,
        createUnit,
        addProduct,
        updateProduct,
        adjustProductStock,
        deleteProduct,
        sales,
        addSale,
        creditBills,
        addCreditBill,
        collectCreditPayment,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        purchases,
        addPurchaseBill,
        cancelPurchaseBill,
        partyLedger,
        recordPartyPayment,
        customers,
        addCustomer,
        updateCustomer,
        deactivateCustomer,
        suppliers,
        addSupplier,
        updateSupplier,
        deactivateSupplier,
        supplierLedger,
        recordSupplierPayment,
        quickCollectTarget,
        setQuickCollectTarget,
        activeReceiptToPrint,
        setActiveReceiptToPrint,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
