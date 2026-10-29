# Able Lubes Inventory & Billing API — Frontend Reference

**Base URL:** `http://192.168.220.20:3000/api/v1`

> All protected endpoints require a Bearer token in the `Authorization` header:
> `Authorization: Bearer <token>`
> Obtain the token from the **Login** endpoint.

---

## Table of Contents

1. [Health](#0-health)
2. [Authentication](#1-authentication)
3. [Customers](#2-customers)
4. [Suppliers](#3-suppliers)
5. [Products](#4-products)
6. [Purchases](#5-purchases)
7. [Sales](#6-sales)
8. [Payments](#7-payments)
9. [Inventory Verification](#8-inventory-verification)
10. [Expenses](#9-expenses)
11. [Reports](#10-reports)

---

## 0. Health

### GET `/health` — API Health Check

Check if the server is running.

**URL:** `http://192.168.220.20:3000/health`

**Headers:** None required

**Response `200 OK`:**
```json
{
  "status": "ok"
}
```

---

## 1. Authentication

### POST `/auth/login` — Login

Authenticate and receive a JWT token.

**URL:** `http://192.168.220.20:3000/api/v1/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "your_admin_password"
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-string",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  }
}
```

> 💡 Save the `data.token` value and send it as `Authorization: Bearer <token>` in all subsequent requests.

---

### POST `/auth/users` — Create Staff User *(Admin only)*

Create a new staff account.

**URL:** `http://192.168.220.20:3000/api/v1/auth/users`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Staff Name",
  "email": "staff@example.com",
  "password": "StaffPass123!",
  "role": "STAFF"
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Staff Name",
    "email": "staff@example.com",
    "role": "STAFF",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 2. Customers

### POST `/customers` — Create Customer

**URL:** `http://192.168.220.20:3000/api/v1/customers`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Anu Auto Works",
  "phone": "9876501234",
  "address": "MG Road, Kochi",
  "active": true
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Anu Auto Works",
    "phone": "9876501234",
    "address": "MG Road, Kochi",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET `/customers` — List Customers

**URL:** `http://192.168.220.20:3000/api/v1/customers?page=1&limit=20&search=Anu`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `page`    | number | No       | Page number (default: 1)     |
| `limit`   | number | No       | Items per page (default: 20) |
| `search`  | string | No       | Search by name               |

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "name": "Anu Auto Works",
      "phone": "9876501234",
      "address": "MG Road, Kochi",
      "active": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET `/customers/:id` — Get Customer by ID

**URL:** `http://192.168.220.20:3000/api/v1/customers/{customerId}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Anu Auto Works",
    "phone": "9876501234",
    "address": "MG Road, Kochi",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH `/customers/:id` — Update Customer

**URL:** `http://192.168.220.20:3000/api/v1/customers/{customerId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body** *(send only fields to update)*:
```json
{
  "phone": "9876501235",
  "address": "Updated address, Kochi"
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Anu Auto Works",
    "phone": "9876501235",
    "address": "Updated address, Kochi",
    "active": true,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH `/customers/:id` — Deactivate Customer *(Soft Delete)*

**URL:** `http://192.168.220.20:3000/api/v1/customers/{customerId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "active": false
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "active": false,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 3. Suppliers

### POST `/suppliers` — Create Supplier

**URL:** `http://192.168.220.20:3000/api/v1/suppliers`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Coastal Lubricants Supply",
  "phone": "9847001122",
  "address": "Industrial Estate, Ernakulam",
  "active": true
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Coastal Lubricants Supply",
    "phone": "9847001122",
    "address": "Industrial Estate, Ernakulam",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET `/suppliers` — List Suppliers

**URL:** `http://192.168.220.20:3000/api/v1/suppliers?page=1&limit=20&search=Coastal`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `page`    | number | No       | Page number (default: 1)     |
| `limit`   | number | No       | Items per page (default: 20) |
| `search`  | string | No       | Search by name               |

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "name": "Coastal Lubricants Supply",
      "phone": "9847001122",
      "address": "Industrial Estate, Ernakulam",
      "active": true
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET `/suppliers/:id` — Get Supplier by ID

**URL:** `http://192.168.220.20:3000/api/v1/suppliers/{supplierId}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Coastal Lubricants Supply",
    "phone": "9847001122",
    "address": "Industrial Estate, Ernakulam",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH `/suppliers/:id` — Update Supplier

**URL:** `http://192.168.220.20:3000/api/v1/suppliers/{supplierId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body** *(send only fields to update)*:
```json
{
  "address": "Updated supplier address"
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Coastal Lubricants Supply",
    "address": "Updated supplier address",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH `/suppliers/:id` — Deactivate Supplier *(Soft Delete)*

**URL:** `http://192.168.220.20:3000/api/v1/suppliers/{supplierId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "active": false
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "active": false,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 4. Products

### POST `/products` — Create Product

**URL:** `http://192.168.220.20:3000/api/v1/products`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Engine Oil 5W-30",
  "sku": "ABLE-5W30-001",
  "unit": "L",
  "sellingPrice": 750,
  "mrp": 850,
  "active": true
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Engine Oil 5W-30",
    "sku": "ABLE-5W30-001",
    "unit": "L",
    "sellingPrice": "750",
    "mrp": "850",
    "currentStock": "0",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

> 💡 `currentStock` starts at `"0"` and increases when purchases are posted.

---

### GET `/products` — List Products

**URL:** `http://192.168.220.20:3000/api/v1/products?page=1&limit=20&search=Engine`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `page`    | number | No       | Page number (default: 1)     |
| `limit`   | number | No       | Items per page (default: 20) |
| `search`  | string | No       | Search by name or SKU        |

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "name": "Engine Oil 5W-30",
      "sku": "ABLE-5W30-001",
      "unit": "L",
      "sellingPrice": "750",
      "mrp": "850",
      "currentStock": "98",
      "active": true
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### GET `/products/:id` — Get Product by ID

**URL:** `http://192.168.220.20:3000/api/v1/products/{productId}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Engine Oil 5W-30",
    "sku": "ABLE-5W30-001",
    "unit": "L",
    "sellingPrice": "750",
    "mrp": "850",
    "currentStock": "100",
    "active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH `/products/:id` — Update Product

**URL:** `http://192.168.220.20:3000/api/v1/products/{productId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body** *(send only fields to update)*:
```json
{
  "mrp": 875
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Engine Oil 5W-30",
    "mrp": "875",
    "currentStock": "0",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### PATCH `/products/:id` — Deactivate Product *(Soft Delete)*

**URL:** `http://192.168.220.20:3000/api/v1/products/{productId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "active": false
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "active": false,
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 5. Purchases

### POST `/purchases` — Post a Purchase

Records a purchase from a supplier and adds stock to the product.

**URL:** `http://192.168.220.20:3000/api/v1/purchases`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "supplierId": "uuid-of-supplier",
  "supplierInvoiceNumber": "SUP-INV-001",
  "discountAmount": 0,
  "items": [
    {
      "productId": "uuid-of-product",
      "quantity": 100,
      "supplierRate": 600
    }
  ]
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "supplierId": "uuid-of-supplier",
    "supplierInvoiceNumber": "SUP-INV-001",
    "totalAmount": "60000",
    "discountAmount": "0",
    "status": "UNPAID",
    "items": [
      {
        "id": "uuid-string",
        "productId": "uuid-of-product",
        "quantity": "100",
        "supplierRate": "600",
        "totalAmount": "60000"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

> 💡 Posting a purchase automatically increases `currentStock` of the product.

---

### POST `/purchases/:id/cancel` — Cancel a Purchase

Cancels an **unpaid** purchase and reverses its stock.

**URL:** `http://192.168.220.20:3000/api/v1/purchases/{purchaseId}/cancel`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** None

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "status": "CANCELLED",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

> ⚠️ Only **UNPAID** purchases can be cancelled. Stock is reversed automatically.

---

## 6. Sales

### POST `/sales` — Post a Sale

Records a sale and deducts stock from the product.

**URL:** `http://192.168.220.20:3000/api/v1/sales`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body (Credit Sale with customer):**
```json
{
  "customerId": "uuid-of-customer",
  "discountAmount": 0,
  "items": [
    {
      "productId": "uuid-of-product",
      "quantity": 2,
      "discountAmount": 25
    }
  ]
}
```

**Request Body (Walk-in / Cash Sale — no customer):**
```json
{
  "items": [
    {
      "productId": "uuid-of-product",
      "quantity": 1,
      "discountAmount": 0
    }
  ]
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "customerId": "uuid-of-customer",
    "totalAmount": "1475",
    "discountAmount": "0",
    "status": "UNPAID",
    "items": [
      {
        "id": "uuid-string",
        "productId": "uuid-of-product",
        "quantity": "2",
        "sellingPrice": "750",
        "discountAmount": "25",
        "totalAmount": "1475"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error `409 Conflict` — Insufficient Stock:**
```json
{
  "error": "Insufficient stock for product uuid-of-product"
}
```

---

### POST `/sales/:id/cancel` — Cancel a Sale

Cancels an **unpaid** sale and restores stock.

**URL:** `http://192.168.220.20:3000/api/v1/sales/{saleId}/cancel`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:** None

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "status": "CANCELLED",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

> ⚠️ Only **UNPAID** sales can be cancelled. Stock is restored automatically.

---

## 7. Payments

### POST `/customer-payments` — Record Customer Payment

Record a payment received from a customer against a sale.

**URL:** `http://192.168.220.20:3000/api/v1/customer-payments`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "customerId": "uuid-of-customer",
  "saleId": "uuid-of-sale",
  "amount": 500,
  "method": "CASH",
  "notes": "Partial payment"
}
```

**Payment Methods:** `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "customerId": "uuid-of-customer",
    "saleId": "uuid-of-sale",
    "amount": "500",
    "method": "CASH",
    "notes": "Partial payment",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### POST `/supplier-payments` — Record Supplier Payment

Record a payment made to a supplier against a purchase.

**URL:** `http://192.168.220.20:3000/api/v1/supplier-payments`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "supplierId": "uuid-of-supplier",
  "purchaseId": "uuid-of-purchase",
  "amount": 5000,
  "method": "UPI",
  "notes": "Partial supplier payment"
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "supplierId": "uuid-of-supplier",
    "purchaseId": "uuid-of-purchase",
    "amount": "5000",
    "method": "UPI",
    "notes": "Partial supplier payment",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 8. Inventory Verification

### GET `/products/:id` — Check Product Stock

Use the standard Get Product endpoint to verify current stock levels.

**URL:** `http://192.168.220.20:3000/api/v1/products/{productId}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "name": "Engine Oil 5W-30",
    "currentStock": "100",
    "unit": "L"
  }
}
```

> 💡 `currentStock` reflects: purchases added − sales deducted − cancelled transactions reversed.

---

## 9. Expenses

### POST `/expenses` — Create Expense

**URL:** `http://192.168.220.20:3000/api/v1/expenses`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "description": "Shop electricity bill",
  "category": "Utilities",
  "amount": 850,
  "paymentMethod": "UPI",
  "notes": "Monthly electricity"
}
```

**Response `201 Created`:**
```json
{
  "data": {
    "id": "uuid-string",
    "description": "Shop electricity bill",
    "category": "Utilities",
    "amount": "850",
    "paymentMethod": "UPI",
    "notes": "Monthly electricity",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET `/expenses` — List Expenses

**URL:** `http://192.168.220.20:3000/api/v1/expenses?page=1&limit=20&search=electricity`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `page`    | number | No       | Page number (default: 1)     |
| `limit`   | number | No       | Items per page (default: 20) |
| `search`  | string | No       | Search by description        |

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "description": "Shop electricity bill",
      "category": "Utilities",
      "amount": "850",
      "paymentMethod": "UPI",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### PATCH `/expenses/:id` — Update Expense

**URL:** `http://192.168.220.20:3000/api/v1/expenses/{expenseId}`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body** *(send only fields to update)*:
```json
{
  "amount": 900,
  "notes": "Updated electricity bill"
}
```

**Response `200 OK`:**
```json
{
  "data": {
    "id": "uuid-string",
    "amount": "900",
    "notes": "Updated electricity bill",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 10. Reports

> All report endpoints accept `from` and `to` as ISO date strings (e.g. `2024-01-01`).

### GET `/reports/purchases` — Purchase Report

**URL:** `http://192.168.220.20:3000/api/v1/reports/purchases?from=2024-01-01&to=2024-12-31`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `from`    | string | Yes      | Start date (YYYY-MM-DD)  |
| `to`      | string | Yes      | End date (YYYY-MM-DD)    |

**Response `200 OK`:**
```json
{
  "data": {
    "totalAmount": "60000",
    "totalItems": 1,
    "purchases": [
      {
        "id": "uuid-string",
        "supplierName": "Coastal Lubricants Supply",
        "totalAmount": "60000",
        "status": "UNPAID",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### GET `/reports/sales` — Daily Sales Report

**URL:** `http://192.168.220.20:3000/api/v1/reports/sales?from=2024-01-01&to=2024-12-31`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `from`    | string | Yes      | Start date (YYYY-MM-DD)  |
| `to`      | string | Yes      | End date (YYYY-MM-DD)    |

**Response `200 OK`:**
```json
{
  "data": {
    "days": [
      {
        "date": "2024-01-01",
        "totalSales": "1475",
        "totalOrders": 1
      }
    ],
    "grandTotal": "1475"
  }
}
```

---

### GET `/reports/expenses` — Expense Report

**URL:** `http://192.168.220.20:3000/api/v1/reports/expenses?from=2024-01-01&to=2024-12-31`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `from`    | string | Yes      | Start date (YYYY-MM-DD)  |
| `to`      | string | Yes      | End date (YYYY-MM-DD)    |

**Response `200 OK`:**
```json
{
  "data": {
    "totalAmount": "850",
    "expenses": [
      {
        "id": "uuid-string",
        "description": "Shop electricity bill",
        "category": "Utilities",
        "amount": "850",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### GET `/reports/customers/outstanding` — Customer Outstanding Balances

**URL:** `http://192.168.220.20:3000/api/v1/reports/customers/outstanding`

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "data": [
    {
      "customerId": "uuid-string",
      "customerName": "Anu Auto Works",
      "totalSales": "1475",
      "totalPaid": "500",
      "outstanding": "975"
    }
  ]
}
```

---

### GET `/reports/suppliers/outstanding` — Supplier Outstanding Balances

**URL:** `http://192.168.220.20:3000/api/v1/reports/suppliers/outstanding`

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "data": [
    {
      "supplierId": "uuid-string",
      "supplierName": "Coastal Lubricants Supply",
      "totalPurchases": "60000",
      "totalPaid": "5000",
      "outstanding": "55000"
    }
  ]
}
```

---

### GET `/reports/monthly` — Monthly Summary

**URL:** `http://192.168.220.20:3000/api/v1/reports/monthly?from=2024-01-01&to=2024-12-31`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `from`    | string | Yes      | Start date (YYYY-MM-DD)  |
| `to`      | string | Yes      | End date (YYYY-MM-DD)    |

**Response `200 OK`:**
```json
{
  "data": {
    "months": [
      {
        "month": "2024-01",
        "totalSales": "1475",
        "totalPurchases": "60000",
        "totalExpenses": "850",
        "netProfit": "-59375"
      }
    ]
  }
}
```

---

## Common Response Patterns

### Success Response Structure
```json
{
  "data": { ... }
}
```

### Paginated Response Structure
```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error Response Structure
```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

| Code | Meaning                                      |
|------|----------------------------------------------|
| 200  | OK — Request succeeded                       |
| 201  | Created — Resource created successfully      |
| 400  | Bad Request — Invalid input data             |
| 401  | Unauthorized — Missing or invalid token      |
| 403  | Forbidden — Insufficient permissions         |
| 404  | Not Found — Resource does not exist          |
| 409  | Conflict — e.g. insufficient stock for sale  |
| 500  | Internal Server Error                        |

---

## Authentication Flow for Frontend

```
1. POST /auth/login  →  receive token
2. Store token in localStorage / state
3. Add to every request:
   headers: { Authorization: `Bearer ${token}` }
```

---

*Generated from Able Lubes Inventory & Billing API Postman Collection*
*Base URL: http://192.168.220.20:3000/api/v1*
