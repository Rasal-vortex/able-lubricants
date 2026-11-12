# Backend handoff for Able Lubes developer

## Source of truth

- Repository: `Rasal-vortex/able-lubes-rasal-backend`
- Branch: `main`
- Latest pushed commit reviewed: `1ad6ca5` — **Add gram display quantities and backend updates**
- The latest commit includes the prior coupon-history commit `a4daac1` and unit-snapshot migration repair `6c8ed7b` in its history.
- These commits were pushed. The app was already deployed by the user. The gram display migration was applied to the Railway database during troubleshooting; verify deployed migration status before applying it again.

If the developer needs the exact code, sync from the repository's `main` branch. The patches below are included for review and porting when syncing isn't possible.

## Final behavior to preserve

### Coupon redemption and split sale payments

Commit `a4daac1` added coupon redemption history and usage protections:

- Coupon records expose redeemed and remaining values.
- `GET /coupons/redemptions` exposes coupon payment history.
- Used coupons cannot be deleted or have their code changed; their value cannot be reduced below the amount already redeemed.
- Daily Sales includes the coupon code associated with a payment.
- API documentation describes these features.

The newer rule in `1ad6ca5` supersedes the older coupon-payment validation from `a4daac1` for Billing split-mode claims:

- A split-mode coupon claim uses a code that is not present in Coupon records and has not been used in another coupon payment.
- Reject a recorded coupon code or previously used code.
- Record the submitted code with its bill payment and return `saleId` plus `isSaleBased` in redemption history so a bill-linked claim is classified as Sale-based.
- Do not require a Regular coupon record or subtract the claim from a Regular coupon's remaining value for split payments.
- Preserve Regular coupon management and redemption protections for coupons managed through the Coupon section.
- No database migration was added for this classification behavior.

### Gram entry for kilogram products

Commit `1ad6ca5` adds display quantity snapshots for kilogram product sales:

- The sale request stores canonical `quantity` in kilograms for stock/pricing and optional display quantity in whole grams for the amount entered by staff.
- Backend validation requires the display fields together and confirms `displayQuantity / 1000` equals the saved kilogram quantity for a Kilogram (`kg`) product.
- Inventory decrement, sale total, and profit calculation continue to use kilograms.
- Sale serializers and Daily Sales / sales report output show the gram amount and `g` unit that staff entered.
- Migration `20261111180000_sale_display_quantity` adds nullable display columns to `sale_items`.

### Other changes in `1ad6ca5`

- Expense descriptions are optional and normalize to an empty string when omitted.
- MRP is optional; when present, it must exceed selling price.
- Daily Sales responses include bill total and discount values; supplier ledger rows include purchase IDs.
- OpenAPI summaries were updated for the split coupon rule and optional expense descriptions.
- `package-lock.json` has optional platform metadata churn only; it does not alter runtime behavior.

## Migration repair in `6c8ed7b`

Commit `6c8ed7b` corrects the migration order for unit snapshot fields. It is a separate migration repair, already present in `main`. Preserve the corrected SQL and migration ordering when syncing.

## Verification notes

- The user confirmed a gram-entered sale reduced kilogram stock correctly.
- The user confirmed the backend and frontend are already deployed.
- The one-time behavior check requested for split coupons is: an unrecorded code succeeds once; a code already present in Coupon records or already used in a coupon payment is rejected.
- No schema change is needed for the split-coupon classification itself. The gram display fields do require the migration above.

## Commit patches for review

### `a4daac1` — validate coupon redemptions and expose usage history

````diff
commit a4daac1cccd6ecba4253327fb84deff86256c9f8
Author:     NecttosRasal <rasalnecttos@gmail.com>
AuthorDate: Mon Nov 9 21:49:33 2026 +0530
Commit:     NecttosRasal <rasalnecttos@gmail.com>
CommitDate: Mon Nov 9 21:49:33 2026 +0530

    validate coupon redemptions and expose usage history

diff --git a/src/modules/coupons/coupon.controller.ts b/src/modules/coupons/coupon.controller.ts
index 9030385..d675932 100644
--- a/src/modules/coupons/coupon.controller.ts
+++ b/src/modules/coupons/coupon.controller.ts
@@ -3,6 +3,8 @@ import * as service from "./coupon.service.js";

 export const list = async (req: Request, res: Response) =>
   res.json({ success: true, ...(await service.listCoupons(req.query)) });
+export const redemptions = async (_req: Request, res: Response) =>
+  res.json({ success: true, data: await service.listCouponRedemptions() });
 export const get = async (req: Request, res: Response) =>
   res.json({
     success: true,
diff --git a/src/modules/coupons/coupon.route.ts b/src/modules/coupons/coupon.route.ts
index 7fb467d..04fe4a3 100644
--- a/src/modules/coupons/coupon.route.ts
+++ b/src/modules/coupons/coupon.route.ts
@@ -12,6 +12,7 @@ import { validate } from "../../shared/validate.js";
 const router = Router();
 router.use(authenticate);
 router.get("/", validate("query", couponListSchema), c.list);
+router.get("/redemptions", c.redemptions);
 router.get("/:id", validate("params", couponIdSchema), c.get);
 router.post("/", validate("body", createCouponSchema), c.create);
 router.patch(
diff --git a/src/modules/coupons/coupon.service.ts b/src/modules/coupons/coupon.service.ts
index f3a8dec..51efea4 100644
--- a/src/modules/coupons/coupon.service.ts
+++ b/src/modules/coupons/coupon.service.ts
@@ -1,12 +1,57 @@
+import { Prisma } from "../../../generated/prisma/client.js";
 import { prisma } from "../../config/prisma.js";
 import { ApiError } from "../../shared/errors.js";
 import { pageMeta } from "../../shared/pagination.js";

-const serialize = (coupon: any) => ({
-  ...coupon,
-  price: coupon.price.toString(),
+const couponNotePrefix = "Coupon code: ";
+const redemptionWhere = {
+  method: "COUPON" as const,
+  notes: { startsWith: couponNotePrefix },
+};
+
+const serializeRedemption = (payment: any) => ({
+  id: payment.id,
+  code: payment.notes.slice(couponNotePrefix.length),
+  amount: payment.amount.toString(),
+  paymentDate: payment.paymentDate,
+  billNumber: payment.sale?.invoiceNumber ?? "—",
+  customerName: payment.customer?.name ?? payment.sale?.customer?.name ?? "Walk-in customer",
 });

+const serializeCoupon = (coupon: any, payments: any[]) => {
+  const redemptions = payments
+    .filter((payment) => payment.notes === `${couponNotePrefix}${coupon.code}`)
+    .map(serializeRedemption);
+  const redeemedAmount = redemptions.reduce(
+    (total, redemption) => total.add(new Prisma.Decimal(redemption.amount)),
+    new Prisma.Decimal(0),
+  );
+  return {
+    ...coupon,
+    price: coupon.price.toString(),
+    redeemedAmount: redeemedAmount.toFixed(2),
+    remainingAmount: coupon.isSaleBased
+      ? null
+      : Prisma.Decimal.max(new Prisma.Decimal(0), coupon.price.sub(redeemedAmount)).toFixed(2),
+    redemptions,
+  };
+};
+
+async function getCouponPaymentRows() {
+  return prisma.customerPayment.findMany({
+    where: redemptionWhere,
+    select: {
+      id: true,
+      amount: true,
+      paymentDate: true,
+      notes: true,
+      customer: { select: { name: true } },
+      sale: { select: { invoiceNumber: true, customer: { select: { name: true } } } },
+    },
+    orderBy: { paymentDate: "desc" },
+  });
+}
+
 export async function listCoupons(q: any) {
   const where =
     q.type === "sales-based"
@@ -14,7 +59,7 @@ export async function listCoupons(q: any) {
       : q.type === "non-sale-based"
         ? { isSaleBased: false }
         : {};
-  const [rows, total] = await Promise.all([
+  const [rows, total, payments] = await Promise.all([
     prisma.coupon.findMany({
       where,
       include: { sale: { select: { id: true, invoiceNumber: true } } },
@@ -23,27 +68,33 @@ export async function listCoupons(q: any) {
       take: q.limit,
     }),
     prisma.coupon.count({ where }),
+    getCouponPaymentRows(),
   ]);
   return {
-    data: rows.map(serialize),
+    data: rows.map((coupon) => serializeCoupon(coupon, payments)),
     meta: pageMeta(q.page, q.limit, total),
   };
 }

+export async function listCouponRedemptions() {
+  return (await getCouponPaymentRows()).map(serializeRedemption);
+}
+
 export async function getCoupon(id: string) {
   const coupon = await prisma.coupon.findUnique({
     where: { id },
     include: { sale: { select: { id: true, invoiceNumber: true } } },
   });
   if (!coupon) throw new ApiError(404, "Coupon not found");
-  return serialize(coupon);
+  return serializeCoupon(coupon, await getCouponPaymentRows());
 }

 export async function createCoupon(input: any) {
-  return serialize(
+  return serializeCoupon(
     await prisma.coupon.create({
       data: { code: input.code, price: input.price, isSaleBased: false },
     }),
+    [],
   );
 }

@@ -52,7 +103,17 @@ export async function updateCoupon(id: string, input: any) {
   if (!coupon) throw new ApiError(404, "Coupon not found");
   if (coupon.isSaleBased)
     throw new ApiError(409, "Sale-based coupons must be changed through the sale");
-  return serialize(await prisma.coupon.update({ where: { id }, data: input }));
+  const redeemed = await prisma.customerPayment.aggregate({
+    where: { ...redemptionWhere, notes: `${couponNotePrefix}${coupon.code}` },
+    _sum: { amount: true },
+  });
+  const redeemedAmount = redeemed._sum.amount ?? new Prisma.Decimal(0);
+  if (redeemedAmount.gt(0) && input.code && input.code !== coupon.code)
+    throw new ApiError(409, "A coupon code cannot be changed after it has been used");
+  if (input.price !== undefined && new Prisma.Decimal(input.price).lt(redeemedAmount))
+    throw new ApiError(409, "Coupon value cannot be lower than the amount already redeemed");
+  const updated = await prisma.coupon.update({ where: { id }, data: input });
+  return serializeCoupon(updated, await getCouponPaymentRows());
 }

 export async function deleteCoupon(id: string) {
@@ -60,5 +121,10 @@ export async function deleteCoupon(id: string) {
   if (!coupon) throw new ApiError(404, "Coupon not found");
   if (coupon.isSaleBased)
     throw new ApiError(409, "Sale-based coupons cannot be deleted");
+  const redeemed = await prisma.customerPayment.count({
+    where: { ...redemptionWhere, notes: `${couponNotePrefix}${coupon.code}` },
+  });
+  if (redeemed > 0)
+    throw new ApiError(409, "A coupon with redemption history cannot be deleted");
   await prisma.coupon.delete({ where: { id } });
 }
diff --git a/src/modules/payments/payment.schema.ts b/src/modules/payments/payment.schema.ts
index f292702..3d5390a 100644
--- a/src/modules/payments/payment.schema.ts
+++ b/src/modules/payments/payment.schema.ts
@@ -6,6 +6,12 @@ export const customerPaymentSchema = z.object({
   paymentDate: z.coerce.date().optional(),
   method: z.enum(["CASH", "UPI", "COUPON"]),
   notes: z.string().trim().max(1000).optional(),
+}).superRefine((payment, ctx) => {
+  if (payment.method !== "COUPON") return;
+  const match = /^Coupon code: (.+)$/.exec(payment.notes ?? "");
+  if (!match || match[1].trim() !== match[1].trim().toUpperCase()) {
+    ctx.addIssue({ code: "custom", path: ["notes"], message: "A normalized coupon code is required for coupon payments" });
+  }
 });
 export const supplierPaymentSchema = z.object({
   supplierId: z.uuid(),
diff --git a/src/modules/payments/payment.service.ts b/src/modules/payments/payment.service.ts
index a98982f..50a06ea 100644
--- a/src/modules/payments/payment.service.ts
+++ b/src/modules/payments/payment.service.ts
@@ -26,6 +26,26 @@ export async function recordCustomerPayment(input: any) {
           400,
           "Payment exceeds the invoice outstanding amount",
         );
+      if (input.method === "COUPON") {
+        const couponCode = /^Coupon code: (.+)$/.exec(input.notes ?? "")?.[1];
+        if (!couponCode)
+          throw new ApiError(400, "A coupon code is required for coupon payments");
+        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
+        if (!coupon || coupon.isSaleBased)
+          throw new ApiError(404, "A regular coupon with this code was not found");
+        const couponPayments = await tx.customerPayment.aggregate({
+          where: { method: "COUPON", notes: `Coupon code: ${couponCode}` },
+          _sum: { amount: true },
+        });
+        const remainingCouponValue = coupon.price.sub(
+          couponPayments._sum.amount ?? amount(0),
+        );
+        if (paymentAmount.gt(remainingCouponValue))
+          throw new ApiError(
+            400,
+            `Coupon ${couponCode} has only ${remainingCouponValue.toFixed(2)} remaining`,
+          );
+      }
       const payment = await paymentModel.createCustomerPayment(
         {
           ...input,
diff --git a/src/modules/reports/report.model.ts b/src/modules/reports/report.model.ts
index ba33ca9..1f66d81 100644
--- a/src/modules/reports/report.model.ts
+++ b/src/modules/reports/report.model.ts
@@ -42,7 +42,7 @@ export const reportModel = {
   dailyPayments: (from: Date, to: Date) => prisma.customerPayment.findMany({
     where: { paymentDate: { gte: from, lt: to }, sale: { status: "POSTED" } },
     select: {
-      id: true, amount: true, method: true, paymentDate: true,
+      id: true, amount: true, method: true, paymentDate: true, notes: true,
       sale: {
         select: {
           id: true, invoiceNumber: true, billDate: true, totalAmount: true,
diff --git a/src/modules/reports/report.service.ts b/src/modules/reports/report.service.ts
index 1122a9c..ea9a71e 100644
--- a/src/modules/reports/report.service.ts
+++ b/src/modules/reports/report.service.ts
@@ -116,7 +116,7 @@ export async function dailySales(date: string) {
       })),
       payments: [],
     };
-    bill.payments.push({ id: payment.id, method: payment.method, amount: payment.amount.toFixed(2), date: payment.paymentDate });
+    bill.payments.push({ id: payment.id, method: payment.method, amount: payment.amount.toFixed(2), date: payment.paymentDate, notes: payment.notes });
     bySale.set(sale.id, bill);
     collected = collected.add(payment.amount);
     byMethod.set(payment.method, (byMethod.get(payment.method) ?? decimal(0)).add(payment.amount));
diff --git a/src/openapi.ts b/src/openapi.ts
index 535e1bd..273c08e 100644
--- a/src/openapi.ts
+++ b/src/openapi.ts
@@ -134,6 +134,13 @@ export const openApiDocument = {
         responses: { "201": { description: "Created coupon" } },
       },
     },
+    "/coupons/redemptions": {
+      get: {
+        summary: "List recorded coupon payments with their bills and customers",
+        security: [{ bearerAuth: [] }],
+        responses: { "200": { description: "Coupon redemption history" } },
+      },
+    },
     "/coupons/{id}": {
       get: {
         summary: "Get coupon",
@@ -230,7 +237,7 @@ export const openApiDocument = {
     },
     "/customer-payments": {
       post: {
-        summary: "Record a Cash, UPI, or Coupon payment against one invoice; call once per payment mode",
+        summary: "Record a Cash, UPI, or Coupon payment against one invoice; coupon payments require a valid regular coupon code and consume its remaining value",
         security: [{ bearerAuth: [] }],
         responses: { "201": { description: "Recorded payment" } },
       },
````

### `6c8ed7b` — correct unit snapshot migration order

````diff
commit 6c8ed7beba317b3542a9362476c76773797e42b7
Author:     NecttosRasal <rasalnecttos@gmail.com>
AuthorDate: Mon Nov 9 16:15:59 2026 +0530
Commit:     NecttosRasal <rasalnecttos@gmail.com>
CommitDate: Mon Nov 9 16:15:59 2026 +0530

    fix(db): correct unit snapshot migration order

diff --git a/prisma/migrations/20261107115048/migration.sql b/prisma/migrations/20261107115048/migration.sql
index ea7043f..8dc052e 100644
--- a/prisma/migrations/20261107115048/migration.sql
+++ b/prisma/migrations/20261107115048/migration.sql
@@ -1,5 +1,2 @@
--- AlterTable
-ALTER TABLE "purchase_items" ALTER COLUMN "unit_symbol_snapshot" SET DATA TYPE TEXT;
-
--- AlterTable
-ALTER TABLE "sale_items" ALTER COLUMN "unit_symbol_snapshot" SET DATA TYPE TEXT;
+-- The snapshot columns are created as TEXT by
+-- 20261107130000_client_feedback_backend.
diff --git a/prisma/migrations/20261107130000_client_feedback_backend/migration.sql b/prisma/migrations/20261107130000_client_feedback_backend/migration.sql
index 1bf044a..c3dbbdf 100644
--- a/prisma/migrations/20261107130000_client_feedback_backend/migration.sql
+++ b/prisma/migrations/20261107130000_client_feedback_backend/migration.sql
@@ -2,7 +2,7 @@ ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'COUPON';

 ALTER TABLE "sale_items"
   ADD COLUMN "unit_name_snapshot" TEXT,
-  ADD COLUMN "unit_symbol_snapshot" VARCHAR(5),
+  ADD COLUMN "unit_symbol_snapshot" TEXT,
   ADD COLUMN "unit_allows_decimals_snapshot" BOOLEAN;

 UPDATE "sale_items" AS item
@@ -19,7 +19,7 @@ ALTER TABLE "sale_items"

 ALTER TABLE "purchase_items"
   ADD COLUMN "unit_name_snapshot" TEXT,
-  ADD COLUMN "unit_symbol_snapshot" VARCHAR(5),
+  ADD COLUMN "unit_symbol_snapshot" TEXT,
   ADD COLUMN "unit_allows_decimals_snapshot" BOOLEAN;

 UPDATE "purchase_items" AS item
````

### `1ad6ca5` — gram display quantities and backend updates; replaces split coupon rule

````diff
commit 1ad6ca5c948ad9eaccce8c2392018c9ef73777e6
Author:     Rasal-vortex <rasal.vth@gmail.com>
AuthorDate: Wed Nov 11 17:26:50 2026 +0530
Commit:     Rasal-vortex <rasal.vth@gmail.com>
CommitDate: Wed Nov 11 17:26:50 2026 +0530

    Add gram display quantities and backend updates

diff --git a/package-lock.json b/package-lock.json
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
diff --git a/prisma/migrations/20261111180000_sale_display_quantity/migration.sql b/prisma/migrations/20261111180000_sale_display_quantity/migration.sql
new file mode 100644
index 0000000..dabd2bc
--- /dev/null
+++ b/prisma/migrations/20261111180000_sale_display_quantity/migration.sql
@@ -0,0 +1,4 @@
+ALTER TABLE "sale_items"
+  ADD COLUMN "display_quantity" DECIMAL(12,3),
+  ADD COLUMN "display_unit_name_snapshot" TEXT,
+  ADD COLUMN "display_unit_symbol_snapshot" TEXT;
\ No newline at end of file
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
