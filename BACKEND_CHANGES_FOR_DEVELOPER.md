# Backend changes for the Able Lubes developer

This handoff is based on the current local working tree at `C:\Users\DELL\Documents\GitHub\able-lubes-rasal-backend`. These changes are local and uncommitted. Port them into the backend developer's repository and review them before committing.

## Changes by area

### Gram entry for Kilogram products

- `prisma/schema.prisma`: adds optional `displayQuantity`, `displayUnitNameSnapshot`, and `displayUnitSymbolSnapshot` fields to `SaleItem`. The existing `quantity` remains the canonical kilogram amount used for stock and pricing.
- `src/modules/sales/sale.schema.ts`: accepts gram display metadata on a sale line, requires the fields together, and restricts the display unit to `Gram` / `g`.
- `src/modules/transactions/transaction.service.ts`: validates that the product is a kilogram unit and that `displayQuantity / 1000` equals the canonical `quantity`; saves the gram amount and unit snapshots while preserving kilogram values for inventory decrement and price/profit calculations.
- `src/modules/sales/sale.serializer.ts`: returns the stored display quantity and unit in sale responses.
- `src/modules/reports/report.model.ts` and `src/modules/reports/report.service.ts`: include the display fields in sales and Daily Sales responses. Profit calculation continues to use canonical kilograms.
- New migration: `prisma/migrations/20261111180000_sale_display_quantity/migration.sql` adds the three nullable columns to `sale_items`.

### Other backend changes in the current working tree

- `src/modules/coupons/coupon.service.ts`: coupon redemption responses include `saleId` and `isSaleBased`.
- `src/modules/payments/payment.service.ts`: coupon codes recorded as split-sale coupon payments must be unrecorded; reusing a recorded coupon code is rejected.
- `src/modules/expenses/expense.schema.ts` and `src/modules/expenses/expense.service.ts`: expense description is optional and normalized to an empty string when absent.
- `src/modules/products/product.schema.ts` and `src/modules/products/product.service.ts`: MRP may be omitted or null; when present, it must be greater than selling price.
- `src/modules/reports/report.service.ts`: daily sales rows include discount and bill total; supplier ledger rows include the purchase ID.
- `src/openapi.ts`: updates API descriptions for coupon payments and optional expense descriptions.
- `package-lock.json`: contains optional platform metadata changes only; no runtime feature behavior is represented by this diff.

## Database migration

```sqlALTER TABLE "sale_items"
  ADD COLUMN "display_quantity" DECIMAL(12,3),
  ADD COLUMN "display_unit_name_snapshot" TEXT,
  ADD COLUMN "display_unit_symbol_snapshot" TEXT;```

Apply the migration to the intended database using the project's normal Prisma deployment workflow. The user's Railway database was migrated during troubleshooting; verify migration status in the developer's environment before applying it again.

## Full tracked-file diff

The following is the current diff for the tracked files listed above. The migration is shown separately because it is a new untracked file.

````diffdiff --git a/package-lock.json b/package-lock.json
index 6667f83..9d60ed0 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -568,9 +568,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1036,9 +1033,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1053,9 +1047,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1070,9 +1061,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1087,9 +1075,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1104,9 +1089,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1121,9 +1103,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1138,9 +1117,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1155,9 +1131,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1172,9 +1145,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1189,9 +1159,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1206,9 +1173,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1223,9 +1187,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1240,9 +1201,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 93d98d6..3320252 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -209,6 +209,9 @@ model SaleItem {
   productId              String   @map("product_id") @db.Uuid
   product                Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
   quantity               Decimal  @db.Decimal(12, 3)
+  displayQuantity        Decimal? @map("display_quantity") @db.Decimal(12, 3)
+  displayUnitNameSnapshot String?  @map("display_unit_name_snapshot")
+  displayUnitSymbolSnapshot String? @map("display_unit_symbol_snapshot")
   unitSellingPrice       Decimal  @map("unit_selling_price") @db.Decimal(12, 2)
   discountAmount         Decimal  @default(0) @map("discount_amount") @db.Decimal(12, 2)
   lineTotal              Decimal  @map("line_total") @db.Decimal(12, 2)
diff --git a/src/modules/coupons/coupon.service.ts b/src/modules/coupons/coupon.service.ts
index 51efea4..ea6fb6d 100644
--- a/src/modules/coupons/coupon.service.ts
+++ b/src/modules/coupons/coupon.service.ts
@@ -14,6 +14,8 @@ const serializeRedemption = (payment: any) => ({
   code: payment.notes.slice(couponNotePrefix.length),
   amount: payment.amount.toString(),
   paymentDate: payment.paymentDate,
+  saleId: payment.saleId,
+  isSaleBased: Boolean(payment.saleId),
   billNumber: payment.sale?.invoiceNumber ?? "—",
   customerName: payment.customer?.name ?? payment.sale?.customer?.name ?? "Walk-in customer",
 });
@@ -45,6 +47,7 @@ async function getCouponPaymentRows() {
       amount: true,
       paymentDate: true,
       notes: true,
+      saleId: true,
       customer: { select: { name: true } },
       sale: { select: { invoiceNumber: true, customer: { select: { name: true } } } },
     },
diff --git a/src/modules/expenses/expense.schema.ts b/src/modules/expenses/expense.schema.ts
index de8bea2..055336a 100644
--- a/src/modules/expenses/expense.schema.ts
+++ b/src/modules/expenses/expense.schema.ts
@@ -2,7 +2,7 @@ import { z } from "zod";
 import { paginationSchema } from "../../shared/pagination.js";
 export const expenseIdSchema = z.object({ id: z.uuid() });
 export const createExpenseSchema = z.object({
-  description: z.string().trim().min(1).max(300),
+  description: z.string().trim().max(300).optional().default(""),
   category: z.string().trim().min(1).max(100),
   amount: z.coerce.number().finite().positive().max(9999999999.99),
   expenseDate: z.coerce.date().optional(),
diff --git a/src/modules/expenses/expense.service.ts b/src/modules/expenses/expense.service.ts
index b021c7c..6772bde 100644
--- a/src/modules/expenses/expense.service.ts
+++ b/src/modules/expenses/expense.service.ts
@@ -34,6 +34,7 @@ export async function createExpense(data: any) {
   return expenseSerializer(
     await expenseModel.create({
       ...data,
+      description: typeof data.description === "string" ? data.description.trim() : "",
       expenseDate: data.expenseDate ?? new Date(),
     }),
   );
diff --git a/src/modules/payments/payment.service.ts b/src/modules/payments/payment.service.ts
index 50a06ea..445afbe 100644
--- a/src/modules/payments/payment.service.ts
+++ b/src/modules/payments/payment.service.ts
@@ -30,21 +30,21 @@ export async function recordCustomerPayment(input: any) {
         const couponCode = /^Coupon code: (.+)$/.exec(input.notes ?? "")?.[1];
         if (!couponCode)
           throw new ApiError(400, "A coupon code is required for coupon payments");
-        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
-        if (!coupon || coupon.isSaleBased)
-          throw new ApiError(404, "A regular coupon with this code was not found");
-        const couponPayments = await tx.customerPayment.aggregate({
-          where: { method: "COUPON", notes: `Coupon code: ${couponCode}` },
-          _sum: { amount: true },
+        const recordedCoupon = await tx.coupon.findUnique({
+          where: { code: couponCode },
+          select: { id: true },
         });
-        const remainingCouponValue = coupon.price.sub(
-          couponPayments._sum.amount ?? amount(0),
-        );
-        if (paymentAmount.gt(remainingCouponValue))
+        if (recordedCoupon)
           throw new ApiError(
-            400,
-            `Coupon ${couponCode} has only ${remainingCouponValue.toFixed(2)} remaining`,
+            409,
+            "Use an unrecorded coupon code for a split sale payment",
           );
+        const priorRedemption = await tx.customerPayment.findFirst({
+          where: { method: "COUPON", notes: `Coupon code: ${couponCode}` },
+          select: { id: true },
+        });
+        if (priorRedemption)
+          throw new ApiError(409, "This coupon code has already been used");
       }
       const payment = await paymentModel.createCustomerPayment(
         {
diff --git a/src/modules/products/product.schema.ts b/src/modules/products/product.schema.ts
index d948cae..f34480d 100644
--- a/src/modules/products/product.schema.ts
+++ b/src/modules/products/product.schema.ts
@@ -8,7 +8,7 @@ const productFields = z.object({
   unitId: z.uuid(),
   purchaseRate: money,
   sellingPrice: money,
-  mrp: money,
+  mrp: money.nullable().optional(),
   qty: z
     .union([
       z.number().finite(),
@@ -25,7 +25,7 @@ const productFields = z.object({
   active: z.boolean().optional(),
 });
 export const createProductSchema = productFields.refine(
-  (product) => product.mrp > product.sellingPrice,
+  (product) => product.mrp == null || product.mrp > product.sellingPrice,
   {
     message: "MRP must be greater than selling price",
     path: ["mrp"],
@@ -36,7 +36,7 @@ export const updateProductSchema = productFields
   .partial()
   .refine(
     (product) =>
-      product.mrp === undefined ||
+      product.mrp == null ||
       product.sellingPrice === undefined ||
       product.mrp > product.sellingPrice,
     { message: "MRP must be greater than selling price", path: ["mrp"] },
diff --git a/src/modules/products/product.service.ts b/src/modules/products/product.service.ts
index 9a22fe7..110f2f9 100644
--- a/src/modules/products/product.service.ts
+++ b/src/modules/products/product.service.ts
@@ -83,12 +83,11 @@ export async function updateProduct(id: string, data: any) {
       });
       if (!product) throw new ApiError(404, "Product not found");
       const sellingPrice = data.sellingPrice ?? product.sellingPrice;
-      const mrp = data.mrp ?? product.mrp;
+      const mrp = data.mrp !== undefined ? data.mrp : product.mrp;
       if (
         (data.mrp !== undefined || data.sellingPrice !== undefined) &&
-        (mrp === null ||
-          mrp === undefined ||
-          Number(mrp) <= Number(sellingPrice))
+        mrp != null &&
+        Number(mrp) <= Number(sellingPrice)
       )
         throw new ApiError(400, "MRP must be greater than selling price");
       if (
diff --git a/src/modules/reports/report.model.ts b/src/modules/reports/report.model.ts
index 1f66d81..7f4b59e 100644
--- a/src/modules/reports/report.model.ts
+++ b/src/modules/reports/report.model.ts
@@ -13,7 +13,7 @@ export const reportModel = {
         customer: { select: { id: true, name: true } },
         items: {
           select: {
-            id: true, quantity: true, unitSellingPrice: true, discountAmount: true,
+            id: true, quantity: true, displayQuantity: true, displayUnitNameSnapshot: true, displayUnitSymbolSnapshot: true, unitSellingPrice: true, discountAmount: true,
             lineTotal: true, historicalCostSnapshot: true,
             unitNameSnapshot: true, unitSymbolSnapshot: true,
             product: { select: { id: true, name: true, purchaseRate: true } },
@@ -45,10 +45,10 @@ export const reportModel = {
       id: true, amount: true, method: true, paymentDate: true, notes: true,
       sale: {
         select: {
-          id: true, invoiceNumber: true, billDate: true, totalAmount: true,
+          id: true, invoiceNumber: true, billDate: true, totalAmount: true, discountAmount: true,
           customer: { select: { id: true, name: true } },
           items: { select: {
-            id: true, quantity: true, unitSellingPrice: true, discountAmount: true,
+            id: true, quantity: true, displayQuantity: true, displayUnitNameSnapshot: true, displayUnitSymbolSnapshot: true, unitSellingPrice: true, discountAmount: true,
             lineTotal: true, unitNameSnapshot: true, unitSymbolSnapshot: true,
             product: { select: { id: true, name: true } },
           } },
diff --git a/src/modules/reports/report.service.ts b/src/modules/reports/report.service.ts
index ea9a71e..c442f86 100644
--- a/src/modules/reports/report.service.ts
+++ b/src/modules/reports/report.service.ts
@@ -58,9 +58,9 @@ export async function salesReport(from: Date, to: Date) {
       items: row.items.map((item) => ({
         productId: item.product.id,
         productName: item.product.name,
-        quantity: item.quantity.toString(),
-        unitName: item.unitNameSnapshot,
-        unitSymbol: item.unitSymbolSnapshot,
+        quantity: (item.displayQuantity ?? item.quantity).toString(),
+        unitName: item.displayUnitNameSnapshot ?? item.unitNameSnapshot,
+        unitSymbol: item.displayUnitSymbolSnapshot ?? item.unitSymbolSnapshot,
         unitSellingPrice: item.unitSellingPrice.toFixed(2),
         discountAmount: item.discountAmount.toFixed(2),
         lineTotal: item.lineTotal.toFixed(2),
@@ -106,11 +106,13 @@ export async function dailySales(date: string) {
     const bill = bySale.get(sale.id) ?? {
       invoiceNumber: sale.invoiceNumber,
       billDate: sale.billDate,
+      discountAmount: sale.discountAmount.toFixed(2),
+      totalAmount: sale.totalAmount.toFixed(2),
       customer: sale.customer?.name ?? "Walk-in customer",
       products: sale.items.map((item) => ({
         productId: item.product.id, productName: item.product.name,
-        quantity: item.quantity.toString(), unitName: item.unitNameSnapshot,
-        unitSymbol: item.unitSymbolSnapshot,
+        quantity: (item.displayQuantity ?? item.quantity).toString(), unitName: item.displayUnitNameSnapshot ?? item.unitNameSnapshot,
+        unitSymbol: item.displayUnitSymbolSnapshot ?? item.unitSymbolSnapshot,
         unitSellingPrice: item.unitSellingPrice.toFixed(2),
         discountAmount: item.discountAmount.toFixed(2), lineTotal: item.lineTotal.toFixed(2),
       })),
@@ -180,6 +182,7 @@ export async function supplierLedger(id: string) {
     billed = billed.add(purchase.totalAmount);
     paid = paid.add(purchasePaid);
     return {
+      id: purchase.id,
       purchaseNumber: purchase.purchaseNumber,
       date: purchase.purchaseDate,
       total: purchase.totalAmount.toFixed(2),
diff --git a/src/modules/sales/sale.schema.ts b/src/modules/sales/sale.schema.ts
index 64b51ec..1d2656f 100644
--- a/src/modules/sales/sale.schema.ts
+++ b/src/modules/sales/sale.schema.ts
@@ -14,8 +14,15 @@ const saleLineSchema = z.object({
       (v) => Number(v) > 0 && Number(v) <= 999999,
       "Quantity must be positive and within the supported range",
     ),
+  displayQuantity: z.coerce.number().finite().int().positive().max(999999999).optional(),
+  displayUnitName: z.literal("Gram").optional(),
+  displayUnitSymbol: z.literal("g").optional(),
   discountAmount: z.coerce.number().finite().min(0).default(0),
-});
+}).refine((line) => {
+  const anyDisplayField = line.displayQuantity !== undefined || line.displayUnitName !== undefined || line.displayUnitSymbol !== undefined;
+  const allDisplayFields = line.displayQuantity !== undefined && line.displayUnitName !== undefined && line.displayUnitSymbol !== undefined;
+  return !anyDisplayField || allDisplayFields;
+}, { message: "Gram display quantity and unit must be provided together", path: ["displayQuantity"] });
 export const createSaleSchema = z
   .object({
     customerId: z.uuid().optional().nullable(),
diff --git a/src/modules/sales/sale.serializer.ts b/src/modules/sales/sale.serializer.ts
index cc74379..28696dc 100644
--- a/src/modules/sales/sale.serializer.ts
+++ b/src/modules/sales/sale.serializer.ts
@@ -3,6 +3,9 @@ export const saleSerializer = (sale: any) => ({
   items: sale.items?.map((item: any) => ({
     ...item,
     quantity: item.quantity.toString(),
+    displayQuantity: item.displayQuantity?.toString() ?? null,
+    displayUnitName: item.displayUnitNameSnapshot ?? null,
+    displayUnitSymbol: item.displayUnitSymbolSnapshot ?? null,
     unitId: item.product?.unit?.id,
     unitName: item.unitNameSnapshot ?? item.product?.unit?.name,
     unitSymbol: item.unitSymbolSnapshot ?? item.product?.unit?.symbol ?? null,
diff --git a/src/modules/transactions/transaction.service.ts b/src/modules/transactions/transaction.service.ts
index bd9f88b..b13006d 100644
--- a/src/modules/transactions/transaction.service.ts
+++ b/src/modules/transactions/transaction.service.ts
@@ -12,6 +12,9 @@ function aggregateItems(
     quantity: number;
     discountAmount: number;
     supplierRate?: number;
+    displayQuantity?: number;
+    displayUnitName?: string;
+    displayUnitSymbol?: string;
   }>,
 ) {
   const map = new Map<string, typeof items>();
@@ -48,8 +51,21 @@ export async function createSale(input: any) {
       let lineDiscounts = dec(0);
       for (const [productId, rows] of grouped) {
         const product = productById.get(productId)!;
-        for (const row of rows) validateQuantity(row.quantity, product.unit);
+        const hasGramDisplay = rows.some((row) => row.displayQuantity !== undefined);
+        if (hasGramDisplay && rows.some((row) => row.displayQuantity === undefined))
+          throw new ApiError(400, "Use one quantity unit for each product line");
+        for (const row of rows) {
+          validateQuantity(row.quantity, product.unit);
+          if (row.displayQuantity !== undefined) {
+            const isKilogram = product.unit.name.trim().toLowerCase() === "kilogram" || product.unit.symbol?.trim().toLowerCase() === "kg";
+            if (!isKilogram || row.displayUnitName !== "Gram" || row.displayUnitSymbol !== "g" || !dec(row.displayQuantity).div(1000).eq(dec(row.quantity)))
+              throw new ApiError(400, "Gram quantity must match the product quantity in kilograms");
+          }
+        }
         const quantity = totalQuantity(rows);
+        const displayQuantity = hasGramDisplay
+          ? totalQuantity(rows.map((row) => ({ quantity: row.displayQuantity! })))
+          : undefined;
         const discount = totalDiscount(rows);
         let calculated;
         try {
@@ -69,6 +85,11 @@ export async function createSale(input: any) {
           unitNameSnapshot: product.unit.name,
           unitSymbolSnapshot: product.unit.symbol,
           unitAllowsDecimalsSnapshot: product.unit.allowsDecimals,
+          ...(displayQuantity ? {
+            displayQuantity,
+            displayUnitNameSnapshot: "Gram",
+            displayUnitSymbolSnapshot: "g",
+          } : {}),
         });
       }
       const couponPrice = dec(input.couponPrice ?? 0);
diff --git a/src/openapi.ts b/src/openapi.ts
index 273c08e..f22e809 100644
--- a/src/openapi.ts
+++ b/src/openapi.ts
@@ -237,7 +237,7 @@ export const openApiDocument = {
     },
     "/customer-payments": {
       post: {
-        summary: "Record a Cash, UPI, or Coupon payment against one invoice; coupon payments require a valid regular coupon code and consume its remaining value",
+        summary: "Record a Cash, UPI, or Coupon payment against one invoice; split-sale coupon payments use an unrecorded code that cannot be reused",
         security: [{ bearerAuth: [] }],
         responses: { "201": { description: "Recorded payment" } },
       },
@@ -256,7 +256,7 @@ export const openApiDocument = {
         responses: { "200": { description: "Paginated expenses" } },
       },
       post: {
-        summary: "Record expense",
+        summary: "Record expense (description optional)",
         security: [{ bearerAuth: [] }],
         responses: { "201": { description: "Created expense" } },
       },
````
