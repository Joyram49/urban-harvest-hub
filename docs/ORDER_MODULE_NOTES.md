# 📦 Order Module — Urban Harvest Hub

## Overview

The Order Module converts a customer's cart into a confirmed order. It handles
the full order lifecycle from placement through delivery (or cancellation),
enforces a strict status state machine, coordinates multi-role access, restores
stock on cancellation, and clears the cart atomically using a single Prisma
transaction.

---

## Table of Contents

- [Module Files](#module-files)
- [Database Models](#database-models)
- [Order State Machine](#order-state-machine)
- [Business Rules](#business-rules)
- [API Endpoints](#api-endpoints)
- [Request & Response Schemas](#request--response-schemas)
- [Error Reference](#error-reference)
- [Access Control Summary](#access-control-summary)
- [Integration Points](#integration-points)

---

## Module Files

| File                  | Purpose                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `order.types.ts`      | Zod validation schemas + inferred TypeScript types + response interfaces                     |
| `order.service.ts`    | All business logic, Prisma transaction for order placement, state machine, stock restoration |
| `order.controller.ts` | Thin HTTP handlers with Swagger JSDoc annotations                                            |
| `order.routes.ts`     | Express Router with per-route authentication and RBAC middleware                             |

---

## Database Models

### `Order`

| Column            | Type            | Notes                                          |
| ----------------- | --------------- | ---------------------------------------------- |
| `id`              | `cuid`          | Primary key                                    |
| `customerId`      | `String`        | FK → `users.id`                                |
| `orderNumber`     | `String`        | Human-readable unique ID: `UHH-YYYYMMDD-XXXXX` |
| `totalAmount`     | `Decimal(10,2)` | Sum of all item prices                         |
| `discountAmount`  | `Decimal(10,2)` | Coupon/promo discount (default `0`)            |
| `shippingAmount`  | `Decimal(10,2)` | Shipping fee (default `0`)                     |
| `grandTotal`      | `Decimal(10,2)` | `totalAmount + shipping - discount`            |
| `status`          | `OrderStatus`   | See state machine below                        |
| `paymentStatus`   | `PaymentStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED`        |
| `paymentMethod`   | `String?`       | e.g. `stripe`, `cod`                           |
| `paymentRef`      | `String?`       | Payment gateway reference                      |
| `shippingAddress` | `Json`          | Snapshot of address at order time              |
| `notes`           | `String?`       | Customer delivery notes                        |
| `confirmedAt`     | `DateTime?`     | Set when status → `CONFIRMED`                  |
| `shippedAt`       | `DateTime?`     | Set when status → `SHIPPED`                    |
| `deliveredAt`     | `DateTime?`     | Set when status → `DELIVERED`                  |
| `cancelledAt`     | `DateTime?`     | Set when status → `CANCELLED`                  |
| `cancelReason`    | `String?`       | Optional cancellation note                     |
| `createdAt`       | `DateTime`      | Auto                                           |
| `updatedAt`       | `DateTime`      | Auto                                           |

### `OrderItem`

| Column       | Type            | Notes                                 |
| ------------ | --------------- | ------------------------------------- |
| `id`         | `cuid`          | Primary key                           |
| `orderId`    | `String`        | FK → `orders.id`                      |
| `productId`  | `String`        | FK → `products.id`                    |
| `vendorId`   | `String`        | Denormalized for vendor order queries |
| `quantity`   | `Int`           | Quantity ordered                      |
| `unitPrice`  | `Decimal(10,2)` | Price snapshot at order time          |
| `totalPrice` | `Decimal(10,2)` | `unitPrice × quantity`                |

> **Note:** `unitPrice` is a price snapshot — it is captured at placement time
> so historical orders always reflect the price the customer actually paid, even
> if the product price changes later.

---

## Order State Machine

```
                     ┌───────────┐
              ┌─────▶│ CANCELLED │◀───────────────────────┐
              │      └───────────┘                        │
              │                                           │
         ┌────┴────┐    ┌───────────┐    ┌───────────┐   │
PLACE ──▶│ PENDING │──▶ │ CONFIRMED │──▶ │ PREPARING │───┤
         └─────────┘    └───────────┘    └───────────┘   │
                                               │          │
                                               ▼          │
                                         ┌─────────┐      │
                                         │ SHIPPED │──────┘
                                         └─────────┘
                                               │
                                               ▼
                                         ┌───────────┐
                                         │ DELIVERED │
                                         └───────────┘
```

### Allowed Transitions

| Current Status | Allowed Next Statuses         |
| -------------- | ----------------------------- |
| `PENDING`      | `CONFIRMED`, `CANCELLED`      |
| `CONFIRMED`    | `PREPARING`, `CANCELLED`      |
| `PREPARING`    | `SHIPPED`, `CANCELLED`        |
| `SHIPPED`      | `DELIVERED`                   |
| `DELIVERED`    | _(terminal — no transitions)_ |
| `CANCELLED`    | _(terminal — no transitions)_ |
| `REFUNDED`     | _(terminal — no transitions)_ |

Any attempt to make an invalid transition returns `400 Bad Request` with a
message listing the allowed next states.

---

## Business Rules

### Order placement

- Cart must be **non-empty**. Attempting to order with an empty cart returns
  `400`.
- Every cart item is validated before placement:
  - Product must be `ACTIVE` and have `stock ≥ requested quantity`.
  - Product must not be `ARCHIVED`.
  - Owning vendor must be `APPROVED`.
- If any item fails validation, **all errors are collected** and returned
  together in a single `400` response so the customer can fix everything at
  once.
- Placement runs in a **single Prisma transaction**: order creation, stock
  decrement for each product, and cart clear all succeed or all roll back
  together.
- `paymentStatus` starts as `PENDING`. It is set to `PAID` automatically when an
  order reaches `DELIVERED` status (future: wire into a real payment gateway
  webhook).
- The `orderNumber` format is `UHH-YYYYMMDD-XXXXX` (e.g. `UHH-20260418-A3K9F`)
  for human-readable support references.

### Order visibility

| Role     | Can see                                                     |
| -------- | ----------------------------------------------------------- |
| Customer | Only their own orders (`customerId = userId`)               |
| Vendor   | Orders that contain at least one item from their `vendorId` |
| Admin    | All orders                                                  |

### Status update permissions

| Role     | Allowed transitions                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Customer | `PENDING → CANCELLED` (own orders only)                                                                 |
| Vendor   | `PENDING → CONFIRMED`, `CONFIRMED → PREPARING`, `PREPARING → SHIPPED`, `* → CANCELLED` (own items only) |
| Admin    | Any valid transition                                                                                    |

### Stock restoration on cancellation

When an order is cancelled, stock is **restored** to all affected products and
their status is reset to `ACTIVE`. This happens inside a Prisma transaction
batch so partial restores are impossible.

---

## API Endpoints

Base path: `/api/v1/orders`

All endpoints require a valid Bearer token.

---

### `POST /orders`

Place an order from the current cart.

**Auth:** Required (any authenticated user)

**Request Body:**

```json
{
  "shippingAddress": {
    "fullName": "Rahim Uddin",
    "phone": "+8801712345678",
    "addressLine1": "12 Green Street",
    "addressLine2": "Apt 4B",
    "city": "Dhaka",
    "state": "Dhaka Division",
    "postalCode": "1207",
    "country": "Bangladesh"
  },
  "notes": "Please ring the bell twice."
}
```

**Success Response `201`:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Order placed successfully",
  "data": {
    "id": "clx...",
    "customerId": "clx...",
    "orderNumber": "UHH-20260418-A3K9F",
    "totalAmount": "10.50",
    "discountAmount": "0.00",
    "shippingAmount": "0.00",
    "grandTotal": "10.50",
    "status": "PENDING",
    "paymentStatus": "PENDING",
    "paymentMethod": null,
    "paymentRef": null,
    "shippingAddress": {
      "fullName": "Rahim Uddin",
      "phone": "+8801712345678",
      "addressLine1": "12 Green Street",
      "city": "Dhaka",
      "country": "Bangladesh"
    },
    "notes": "Please ring the bell twice.",
    "confirmedAt": null,
    "shippedAt": null,
    "deliveredAt": null,
    "cancelledAt": null,
    "cancelReason": null,
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:00:00.000Z",
    "orderItems": [
      {
        "id": "clx...",
        "orderId": "clx...",
        "productId": "clx...",
        "vendorId": "clx...",
        "quantity": 3,
        "unitPrice": "3.50",
        "totalPrice": "10.50",
        "product": {
          "id": "clx...",
          "name": "Organic Tomatoes",
          "slug": "organic-tomatoes-a7f2k",
          "imageUrl": "https://cdn.example.com/tomatoes.jpg",
          "unit": "kg"
        },
        "vendor": {
          "id": "clx...",
          "businessName": "Green Thumb Farm"
        }
      }
    ],
    "customer": {
      "id": "clx...",
      "firstName": "Rahim",
      "lastName": "Uddin",
      "email": "rahim@example.com"
    }
  }
}
```

**Errors:**

| Status | Reason                                        |
| ------ | --------------------------------------------- |
| `400`  | Cart is empty                                 |
| `400`  | One or more items out of stock or unavailable |
| `400`  | Vendor not approved                           |

---

### `GET /orders/my`

Get the authenticated customer's order history.

**Auth:** Required

**Query Parameters:**

| Param           | Type    | Default | Description                     |
| --------------- | ------- | ------- | ------------------------------- |
| `page`          | integer | `1`     | Page number                     |
| `limit`         | integer | `10`    | Items per page (max 100)        |
| `status`        | enum    | —       | Filter by order status          |
| `paymentStatus` | enum    | —       | Filter by payment status        |
| `sortOrder`     | enum    | `desc`  | `asc` / `desc` by creation date |

**Response `200` (paginated):** Array of order objects with `meta`.

---

### `GET /orders/vendor`

Get orders that contain this vendor's products.

**Auth:** Required — Vendor only

Accepts the same query parameters as `GET /orders/my`. Returns full order
objects; the frontend is responsible for filtering `orderItems` to show only the
vendor's own lines if needed.

---

### `GET /orders`

Get all orders in the system.

**Auth:** Required — Admin only

Accepts the same query parameters as above.

---

### `GET /orders/:id`

Get a single order by ID. Access is role-scoped (see Business Rules above).

**Auth:** Required

**Response `200`:** Full order object.

---

### `PATCH /orders/:id/status`

Update an order's status. Enforces the state machine and role-based permissions.

**Auth:** Required — Vendor or Admin (customers use this same endpoint to
cancel, handled inside the service)

**Request Body:**

```json
{
  "status": "CONFIRMED",
  "cancelReason": "Customer requested cancellation"
}
```

| Field          | Type   | Required | Notes                                                                |
| -------------- | ------ | -------- | -------------------------------------------------------------------- |
| `status`       | enum   | ✅       | One of `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `cancelReason` | string | ❌       | Recommended when `status = CANCELLED`, max 500 chars                 |

**Response `200`:** Full updated order object.

**Errors:**

| Status | Reason                                        |
| ------ | --------------------------------------------- |
| `400`  | Invalid state machine transition              |
| `400`  | Customer trying to cancel a non-pending order |
| `403`  | Role not permitted to make this status change |
| `404`  | Order not found                               |

---

## Request & Response Schemas

### `PlaceOrderInput`

| Field                          | Validation              |
| ------------------------------ | ----------------------- |
| `shippingAddress.fullName`     | Required, min 2 chars   |
| `shippingAddress.phone`        | Required, min 5 chars   |
| `shippingAddress.addressLine1` | Required, min 5 chars   |
| `shippingAddress.addressLine2` | Optional                |
| `shippingAddress.city`         | Required                |
| `shippingAddress.state`        | Optional                |
| `shippingAddress.postalCode`   | Optional                |
| `shippingAddress.country`      | Required, min 2 chars   |
| `notes`                        | Optional, max 500 chars |

### `UpdateOrderStatusInput`

| Field          | Validation                                                                   |
| -------------- | ---------------------------------------------------------------------------- |
| `status`       | Required enum: `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `cancelReason` | Optional string, max 500 chars                                               |

---

## Error Reference

| Status | Scenario                                                |
| ------ | ------------------------------------------------------- |
| `400`  | Cart is empty                                           |
| `400`  | Stock validation failure (one or more items)            |
| `400`  | Invalid order status transition                         |
| `400`  | Customer attempting to cancel a non-PENDING order       |
| `401`  | Missing or invalid JWT token                            |
| `403`  | Customer viewing another customer's order               |
| `403`  | Vendor viewing/updating an order without their products |
| `403`  | Customer attempting a non-cancel status change          |
| `403`  | Vendor attempting a DELIVERED or REFUNDED transition    |
| `404`  | Order not found                                         |
| `404`  | Vendor profile not found (vendor orders endpoint)       |

---

## Access Control Summary

| Endpoint                   | Customer         | Vendor         | Admin |
| -------------------------- | ---------------- | -------------- | ----- |
| `POST /orders`             | ✅               | ✅             | ✅    |
| `GET /orders/my`           | ✅               | ✅             | ✅    |
| `GET /orders/vendor`       | ❌               | ✅ (own items) | ❌    |
| `GET /orders`              | ❌               | ❌             | ✅    |
| `GET /orders/:id`          | ✅ (own)         | ✅ (own items) | ✅    |
| `PATCH /orders/:id/status` | ✅ (cancel only) | ✅ (limited)   | ✅    |

---

## Integration Points

- **Cart Module** — `placeOrder` reads the full cart (via
  `prisma.cart.findUnique` with items) and calls `cartItem.deleteMany` inside
  the transaction to clear it on success.
- **Product Module** — stock is decremented on placement and restored on
  cancellation. Product `status` is auto-set to `OUT_OF_STOCK` when stock
  reaches `0`, and back to `ACTIVE` when stock is restored.
- **Review Module** — reviews should only be allowed on orders in `DELIVERED`
  status (`order.status === 'DELIVERED'`).
- **Notification Module** _(future)_ — emit `order:status_changed` Socket.IO
  events when status updates occur. The service layer is the correct place to
  call `socketEmit.toUser(order.customerId, ...)`.
- **Payment Gateway** _(future)_ — `paymentMethod` and `paymentRef` fields are
  reserved for Stripe/payment webhook data. `paymentStatus` transitions
  (`PENDING → PAID → REFUNDED`) should be driven by webhook handlers, not the
  status update endpoint.

---

## App Registration

Add to `src/app.ts`:

```ts
import orderRoutes from '@/modules/orders/order.routes';

app.use(`/api/${env.API_VERSION}/orders`, orderRoutes);
```
