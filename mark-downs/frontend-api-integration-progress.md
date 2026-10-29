# Frontend API Integration Progress

The API contract is documented in [able-lubes-api-docs.md](./able-lubes-api-docs.md). Update this checklist as each implementation phase is completed and verified.

## Checklist

- [x] **1. API and authentication foundation** — API client, development proxy, Admin/Staff login, role validation, persistent session, and sign out.
- [x] **2. Products** — Load paginated API data; create, edit, and deactivate products. Add/Edit Product has standard Brand/Unit dropdowns, centered blurred dialogs for adding brands/units, and a numeric Qty field. Creation sends `brandId`, `unitId`, and opening `qty`; Admin edits use the stock-adjustment endpoint with a required reason. TypeScript check passes; live product operations still need a browser/API check.
- [x] **3. Customers** — Load paginated customers from the API; create, edit, and soft-deactivate customers through the documented endpoints. Customer list no longer uses seeded browser data. TypeScript check passes; live API operations still need a browser/API check.
- [x] **4. Suppliers** — Load paginated suppliers from the API; create, edit, and soft-deactivate suppliers through documented endpoints. Supplier directory no longer uses seeded browser data or displays demo ledger totals. TypeScript check passes; live API operations still need a browser/API check.
- [x] **5. Sales checkout and stock deduction** — Checkout posts sales to `/sales`, which deducts stock in the backend; the UI updates its stock only after the API confirms success. Product search shows remaining stock and cart quantities are capped. The cashier flow and stock deduction are complete.
- [ ] **5a. Customer payment settlement** — Cash/UPI settlement and payment allocation remain pending clarification of how walk-in sales and multi-sale allocations should work.
- [x] **6. Purchases** — New Purchase UI is complete and follows the requested layout. Purchases post to `/purchases`; the catalog refreshes after stock is received; unpaid purchases can be cancelled to reverse stock; and supplier payments post to `/supplier-payments`. Purchase History has supplier/product/invoice search. The API reference still has no documented purchase list/detail endpoint, so history is not yet backend-paginated or guaranteed to persist across reloads.
- [ ] **7. Expenses (deferred/hidden)** — Expenses are temporarily hidden from the sidebar. Listing, creation, and updates still need backend integration before the section is exposed again.
- [ ] **8. Dashboard, history, ledgers, and reports** — Use available report and outstanding-balance endpoints; reconcile missing record-level API operations with the backend developer.
- [ ] **9. Replace demo persistence and verify integration** — Remove demo/localStorage business data, add loading/error states, and verify the full flows against the API.

## Next step

Expenses are deferred and hidden from the sidebar for now. Next, continue with dashboard, history, ledger, and report data, while resolving the missing record-list APIs with the backend developer.

## API gaps to resolve

The current API reference does not document list/detail endpoints for sales or purchases, credit-bill list/detail endpoints, or payment-history endpoints. Existing history and ledger screens need those records, so coordinate with the backend developer before marking Phase 6 complete.

The older product section in `able-lubes-api-docs.md` predates the catalog-stock API PDF. Use the newer contract for products: product creation accepts `brandId`, `unitId`, and optional opening `qty`; later stock corrections use the admin-only stock-adjustment endpoints.

The ER diagram models customer/supplier payments through allocation join tables, while the API reference accepts one `saleId` per customer payment and one `purchaseId` per supplier payment. Confirm whether each payment can settle multiple transactions before building those flows.

Customer ledger and payment history remain demo-backed. Customer endpoints provide customer records, but customer-payment history/listing is not documented; do not treat the existing ledger totals as API data.
