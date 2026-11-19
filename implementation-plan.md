# ABLE LUBES – BATCH-WISE INVENTORY IMPLEMENTATION

## Implementation status

- Phase 1 – Completed.
- Phase 2 – Completed.
- Phase 3 – Completed.
- Phase 4 – Completed and verified on 2026-11-19.
- Phase 5 – Automated regression checks passed; live database/API E2E remains pending an isolated test database.

## Global instructions for all phases

We are implementing batch-wise purchase and selling prices in Able Lubes.

Follow the approved client requirements:

1. The same product can have multiple stock batches with different purchase and selling prices.
2. Each new purchase of an existing product creates a new batch.
3. Old stock batches must retain their original prices and quantities.
4. Billing must allow staff to select the appropriate batch.
5. Billing's individual PRICE field must remain editable.
6. Editing the PRICE field affects only that invoice. It must never overwrite the original batch selling price.
7. Profit must use the actual final invoice selling price and the purchase cost of the selected batch.
8. All historical sales and reports must remain stable.

### Important protection rules

- Do not reset repositories.
- Do not discard, overwrite or silently modify existing uncommitted work.
- Do not change unrelated features.
- Preserve existing authentication, APIs and validations unless changes are necessary.
- Preserve existing UI theme and layout.
- Do not deploy automatically.
- Never run migrations against production without explicit approval.
- Use database transactions for stock and financial operations.
- Inspect the actual implementation before changing it.

---

# PHASE 1 – Database and batch infrastructure

Implement the necessary backend and database foundation for batch-wise inventory.

### Requirements

Create an appropriate inventory batch data model.

Each batch should contain:

- Batch ID
- Product ID
- Source purchase item ID, where applicable
- Received quantity
- Remaining quantity
- Purchase rate
- Selling rate
- Received date
- Batch source/type (purchase, opening stock, adjustment)
- Status and audit information where needed

Link purchase items to their created batches.

Link each new sale item to the batch from which its stock was deducted.

Each sale item must preserve:

- Selected batch ID
- Actual purchase-cost snapshot
- Original batch selling-price snapshot
- Actual final invoice selling price
- Sold quantity
- Final line amount

A sale item must represent stock from one batch only. If the same product is sold from two batches, retain two separate sale lines.

### Stock consistency

Existing Product.currentStock may remain as an aggregate for compatibility, but it must always equal the sum of the remaining quantities of its batches.

Update both values atomically.

Do not allow negative batch stock or inconsistent aggregate stock.

### Existing inventory migration

Existing purchase records cannot reliably reconstruct historical batch allocations.

Prepare a migration strategy that:

- Preserves current product stock quantities.
- Supports importing manually reconciled opening batches.
- Supports multiple opening batches for one product.
- Provides a single legacy opening batch only when no reliable breakdown is available.
- Never invent historical batch allocations.

Prepare a CSV template for manually reconciling existing stock:

product_id, product_name, batch_label, quantity, purchase_rate, selling_rate.

The sum of reconciled batch quantities must equal the existing product stock.

### Historical sales

Inspect sales with missing historical cost snapshots.

Prepare a safe strategy to freeze their currently reported cost as an estimated legacy cost, clearly distinguishing estimated values from verified batch costs.

Do not rewrite historical sales or reports without an approved migration strategy.

### Deliverables

Implement only the approved schema, backend data model and migration foundation.

Test migration safety and database consistency.

Stop after Phase 1 and report:
- Files changed.
- Schema changes.
- Migration behaviour.
- Legacy stock handling.
- Tests performed.
- Remaining risks.

Wait for approval before Phase 2.

---

# PHASE 2 – Purchase section

Implement batch creation when purchasing an existing product.

### Purchase workflow

1. Staff selects an existing product.
2. Enter purchase quantity.
3. Enter the new purchase rate.
4. Enter the new selling rate.
5. Save the purchase.

On successful purchase creation:

- Create a new inventory batch.
- Store its purchase rate and selling rate.
- Set its received and remaining quantities.
- Link it to the purchase item.
- Increase aggregate product stock.
- Do not overwrite any old batch's prices or quantity.

The product-level current prices may be maintained as defaults or latest-price summaries for compatibility, but must never be used to overwrite or recalculate old batches.

### Frontend

Update the existing Purchase form.

- Make Selling Rate editable.
- Preserve the existing Purchase UI layout and design.
- Do not create duplicate products.
- Display existing product information appropriately.

### Validation

- Reject invalid rates and quantities.
- Ensure batch creation and purchase creation occur in one database transaction.
- Prevent duplicate batches on accidental repeated submission.

### Deliverables

Complete Purchase batch creation, frontend integration and tests.

Stop after Phase 2 and wait for approval.

---

# PHASE 3 – Billing and individual selling-price editing

Implement batch selection in the existing Billing screen.

### Batch selection

When a product has only one available batch, use its selling rate by default and preserve the current user experience.

When a product has multiple available batches, show a dropdown containing:

- Batch identifying information.
- Batch selling price.
- Available quantity.

Do not show purchase cost to customers or in unnecessary parts of the billing UI.

Staff must manually select the batch. Do not assume FIFO or average costing.

### Individual PRICE editing

Preserve the existing editable PRICE field.

Example:

Selected batch:
- Purchase rate: ₹550
- Original selling rate: ₹700

Staff can change the invoice selling price to ₹650.

Expected behaviour:

- Current invoice uses ₹650.
- Original batch selling rate stays ₹700.
- Future invoices default to ₹700.
- The manually entered ₹650 is saved in the sale item.
- The batch purchase-cost snapshot remains ₹550.

### Stock handling

When the invoice is saved:

- Validate selected batch availability.
- Deduct quantity from that specific batch.
- Update aggregate product stock.
- Save batch ID and price snapshots.
- Perform all stock and sale operations atomically.

If the same product is sold from two batches, preserve separate invoice lines and batch references.

Do not merge different batches into one sale line.

### Important

Editing the invoice selling price must never change Product.sellingPrice or InventoryBatch.sellingRate.

Preserve existing payment methods, split payments, credit sales, invoice discounts and coupon behaviour.

Do not double-apply existing discounts.

### Deliverables

Complete Billing batch selection, editable price persistence, stock deduction and tests.

Stop after Phase 3 and wait for approval.

---

# PHASE 4 – Reports, profit calculation and stock operations

Update reports to use batch-linked transaction data.

### Profit calculation

For every newly created sale item:

Actual line revenue = actual final invoice selling price × quantity, subject to existing invoice discount and tax rules.

Product cost = selected batch purchase cost × quantity.

Gross profit = actual net sales revenue - actual cost of sold stock.

Then deduct expenses using the existing reporting rules.

Never calculate new sale profit using the current product-level purchase rate.

### Reports to inspect and update

1. Daily Sales Summary.
2. Profit & Loss.
3. Sales Reports.
4. Purchase Reports.
5. Stock Reports.
6. Dashboard totals.
7. Any other report using product purchase rate or selling price.

Preserve the existing reporting definitions, date filters and expense logic.

### Purchase cancellation

- Allow safe cancellation when the batch has not been consumed and existing payment restrictions are satisfied.
- Block cancellation when any of its stock has already been sold or otherwise consumed, unless a properly tracked reversal workflow exists.
- Do not remove stock from another batch.

### Sale cancellation

Restore cancelled sale quantities to the exact original batches.

Do not simply add the quantity to aggregate product stock.

### Stock adjustments

- Stock increases create a new adjustment batch with an explicitly entered purchase and selling rate.
- Stock decreases must identify the affected batch.
- Maintain aggregate stock consistency.

### Historical reports

Ensure old reports do not change just because new purchases or prices are entered.

Legacy sales with estimated historical costs must remain clearly distinguishable internally from verified batch-based costs.

### Deliverables

Complete report calculations, cancellation handling, stock adjustments and regression tests.

Stop after Phase 4 and wait for approval.

---

# PHASE 5 – Full regression testing

Run end-to-end testing of the completed workflow.

### Test scenario 1 – Different batches

Purchase:

- Old batch: 10 units, purchase ₹400, selling ₹500.
- New batch: 10 units, purchase ₹550, selling ₹700.

Verify both batches remain separate.

### Test scenario 2 – Special selling price

Select new batch at ₹700 in Billing.

Change invoice selling price to ₹650.

Verify:

- Invoice records ₹650.
- Batch selling price remains ₹700.
- Next customer still sees ₹700.
- Profit per unit is ₹100.

### Test scenario 3 – Different stock batches in sales

Sell 2 units from old stock and 2 from new stock.

Verify batch quantities:

- Old stock: 8 remaining.
- New stock: 8 remaining.

Verify profit:

- Old stock: ₹100 per unit.
- New stock: ₹150 per unit.

### Test scenario 4 – Partial batch quantity

Attempt to sell more units than the selected batch contains.

Verify the backend rejects the transaction without changing stock or payment records.

### Test scenario 5 – Multiple batches in one invoice

Sell the same product from two batches in one invoice.

Verify separate sale lines, correct prices, correct batch IDs and correct profit.

### Test scenario 6 – Purchase cancellation

Attempt to cancel an unused purchase batch and a partially consumed purchase batch.

Verify the approved cancellation rules.

### Test scenario 7 – Sale cancellation

Cancel a sale and verify quantity returns to the original batch.

### Test scenario 8 – Historical records

Verify old sales, historical profit and Daily Summary remain stable after new purchases and price changes.

### Test scenario 9 – Other payment methods

Verify cash, UPI, credit and split payments still reconcile with the final invoice amount.

### Test scenario 10 – Entire reports audit

Compare invoice totals, daily sales, purchase totals, stock quantities and Profit & Loss.

Identify any mismatch.

### Final deliverables

Provide:

- Files changed.
- Database migration details.
- Test results.
- Any unresolved issues.
- Confirmation that unrelated supplier receipt-number changes were preserved.
- Deployment and production migration instructions.

Do not deploy or modify production data automatically. Wait for explicit approval.
