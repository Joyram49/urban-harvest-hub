# 🛒 Cart Module — Urban Harvest Hub

## Overview

The Cart Module gives every authenticated user a persistent shopping cart. It
handles adding products, updating quantities, removing individual items, and
clearing the full cart — with stock validation at every mutation and a computed
`summary` object on every response so the frontend never has to recalculate
totals.

---

## Table of Contents

- [Module Files](#module-files)
- [Database Models](#database-models)
- [Business Rules](#business-rules)
- [API Endpoints](#api-endpoints)
- [Request & Response Schemas](#request--response-schemas)
- [Cart Summary Object](#cart-summary-object)
- [Error Reference](#error-reference)
- [Access Control Summary](#access-control-summary)
- [Integration Points](#integration-points)

---

## Module Files

| File                 | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `cart.types.ts`      | Zod validation schemas + inferred TypeScript types + response interfaces |
| `cart.service.ts`    | All business logic, Prisma queries, stock checks, summary computation    |
| `cart.controller.ts` | Thin HTTP handlers — calls service, calls `sendSuccess`                  |
| `cart.routes.ts`     | Express Router — all routes require `authenticate` middleware            |

---

## Database Models

### `Cart`

One cart per user (unique on `userId`). Created lazily on first cart access.

| Column      | Type       | Notes                   |
| ----------- | ---------- | ----------------------- |
| `id`        | `cuid`     | Primary key             |
| `userId`    | `String`   | FK → `users.id`, unique |
| `createdAt` | `DateTime` | Auto                    |
| `updatedAt` | `DateTime` | Auto                    |

### `CartItem`

One row per product in the cart. The `cartId + productId` pair is unique —
adding the same product twice merges quantities rather than creating a duplicate
row.

| Column      | Type       | Notes              |
| ----------- | ---------- | ------------------ |
| `id`        | `cuid`     | Primary key        |
| `cartId`    | `String`   | FK → `carts.id`    |
| `productId` | `String`   | FK → `products.id` |
| `quantity`  | `Int`      | 1–100 per item     |
| `createdAt` | `DateTime` | Auto               |
| `updatedAt` | `DateTime` | Auto               |

---

## Business Rules

### Cart lifecycle

- Every authenticated user gets exactly **one** cart. The cart is auto-created
  on the first `GET /cart` or `POST /cart` call — callers never need to
  explicitly create a cart.
- Clearing the cart (`DELETE /cart`) removes all `CartItem` rows but keeps the
  `Cart` record alive, preserving the `cartId` for future additions.

### Adding items

- If the product is already in the cart, quantities are **merged**
  (`existingQty + newQty`), never duplicated.
- Validates product `status` is `ACTIVE` and `stock > 0`. `OUT_OF_STOCK` and
  `ARCHIVED` products are rejected with a clear error message.
- Combined quantity (existing + new) must not exceed `product.stock`.
- Hard cap of **100 units** per line item regardless of stock.

### Updating quantity

- Sets the quantity to the **exact value** provided (not a delta).
- Validates the new quantity against current `product.stock`.
- Ownership is verified — users can only modify items in their own cart.

### Removing items

- Hard-deletes the `CartItem` row.
- Ownership is verified before deletion.

### Summary computation

Every response includes a computed `summary` object (see
[Cart Summary Object](#cart-summary-object)). The `subtotal` only counts items
whose product is currently `ACTIVE` with `stock > 0`; unavailable items are
counted separately so the UI can surface a warning.

---

## API Endpoints

Base path: `/api/v1/cart`

All endpoints require a valid Bearer token (authenticated users of any role).

---

### `GET /cart`

Fetch the current user's cart.

**Auth:** Required

**Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cart fetched successfully",
  "data": {
    "id": "clx...",
    "userId": "clx...",
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:05:00.000Z",
    "items": [
      {
        "id": "clx...",
        "cartId": "clx...",
        "productId": "clx...",
        "quantity": 3,
        "createdAt": "2026-04-18T10:01:00.000Z",
        "updatedAt": "2026-04-18T10:01:00.000Z",
        "product": {
          "id": "clx...",
          "name": "Organic Tomatoes",
          "slug": "organic-tomatoes-a7f2k",
          "price": "3.50",
          "comparePrice": "5.00",
          "imageUrl": "https://cdn.example.com/tomatoes.jpg",
          "stock": 120,
          "unit": "kg",
          "status": "ACTIVE",
          "isOrganic": true,
          "isCertified": false,
          "vendor": {
            "id": "v1...",
            "businessName": "Green Thumb Farm"
          }
        }
      }
    ],
    "summary": {
      "itemCount": 1,
      "totalQuantity": 3,
      "subtotal": 10.5,
      "unavailableItems": 0
    }
  }
}
```

---

### `POST /cart`

Add a product to the cart. Merges quantity if the product is already present.

**Auth:** Required

**Request Body:**

```json
{
  "productId": "clx...",
  "quantity": 2
}
```

| Field       | Type    | Required | Notes                               |
| ----------- | ------- | -------- | ----------------------------------- |
| `productId` | string  | ✅       | Must be an active, in-stock product |
| `quantity`  | integer | ❌       | 1–100, defaults to `1`              |

**Response `200`:** Returns the full updated cart (same shape as `GET /cart`).

**Errors:**

| Status | Reason                                    |
| ------ | ----------------------------------------- |
| `400`  | Product is out of stock                   |
| `400`  | Combined quantity exceeds available stock |
| `400`  | Quantity would exceed 100-unit cap        |
| `404`  | Product not found or archived             |

---

### `PATCH /cart/items/:itemId`

Set an exact quantity for a cart item.

**Auth:** Required

**Path Parameter:** `itemId` — the `CartItem.id`

**Request Body:**

```json
{
  "quantity": 5
}
```

| Field      | Type    | Required | Notes                                  |
| ---------- | ------- | -------- | -------------------------------------- |
| `quantity` | integer | ✅       | 1–100; must not exceed `product.stock` |

**Response `200`:** Returns the full updated cart.

**Errors:**

| Status | Reason                                    |
| ------ | ----------------------------------------- |
| `400`  | Quantity exceeds available stock          |
| `400`  | Product is no longer available (archived) |
| `403`  | Cart item belongs to a different user     |
| `404`  | Cart item not found                       |

---

### `DELETE /cart/items/:itemId`

Remove a single item from the cart.

**Auth:** Required

**Path Parameter:** `itemId` — the `CartItem.id`

**Response `200`:** Returns the full updated cart with the item removed.

**Errors:**

| Status | Reason                                |
| ------ | ------------------------------------- |
| `403`  | Cart item belongs to a different user |
| `404`  | Cart item not found                   |

---

### `DELETE /cart`

Clear all items from the cart.

**Auth:** Required

**Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cart cleared successfully",
  "data": {
    "id": "clx...",
    "userId": "clx...",
    "items": [],
    "summary": {
      "itemCount": 0,
      "totalQuantity": 0,
      "subtotal": 0,
      "unavailableItems": 0
    }
  }
}
```

---

## Request & Response Schemas

### `AddToCartInput`

| Field       | Validation                          |
| ----------- | ----------------------------------- |
| `productId` | Required non-empty string           |
| `quantity`  | Optional integer 1–100, default `1` |

### `UpdateCartItemInput`

| Field      | Validation             |
| ---------- | ---------------------- |
| `quantity` | Required integer 1–100 |

---

## Cart Summary Object

Every cart response includes a `summary` object computed server-side:

| Field              | Type    | Description                                                                         |
| ------------------ | ------- | ----------------------------------------------------------------------------------- |
| `itemCount`        | integer | Number of distinct products in the cart                                             |
| `totalQuantity`    | integer | Sum of all item quantities                                                          |
| `subtotal`         | number  | Sum of `price × quantity` for **available** items only, rounded to 2 decimal places |
| `unavailableItems` | integer | Count of items whose product is `OUT_OF_STOCK` or `ARCHIVED`                        |

When `unavailableItems > 0`, the frontend should surface a warning before
allowing checkout, as those items will not be included in the order.

---

## Error Reference

| Status | Scenario                                             |
| ------ | ---------------------------------------------------- |
| `400`  | Validation failed (missing fields, invalid quantity) |
| `400`  | Product is out of stock                              |
| `400`  | Quantity exceeds available stock                     |
| `400`  | Product is no longer available (archived)            |
| `401`  | Missing or invalid JWT token                         |
| `403`  | Attempting to modify another user's cart item        |
| `404`  | Product not found                                    |
| `404`  | Cart item not found                                  |

---

## Access Control Summary

| Endpoint                     | Public | Customer | Vendor | Admin |
| ---------------------------- | ------ | -------- | ------ | ----- |
| `GET /cart`                  | ❌     | ✅       | ✅     | ✅    |
| `POST /cart`                 | ❌     | ✅       | ✅     | ✅    |
| `PATCH /cart/items/:itemId`  | ❌     | ✅       | ✅     | ✅    |
| `DELETE /cart/items/:itemId` | ❌     | ✅       | ✅     | ✅    |
| `DELETE /cart`               | ❌     | ✅       | ✅     | ✅    |

All authenticated roles (Customer, Vendor, Admin) can manage a cart. Each user's
cart is isolated — ownership is enforced at the item level.

---

## Integration Points

- **Product Module** — stock and status are validated on every add/update. The
  cart stores `productId` only; current price/stock are fetched live.
- **Order Module** — when a customer places an order (`POST /orders`), the Order
  module reads the cart, validates stock again, creates `OrderItem` records, and
  calls `clearCart()` on success. The cart is never automatically cleared until
  an order is confirmed.
- **Certification Module** — `isCertified` on product items in the cart response
  allows the UI to badge certified products in the cart view.

---

## App Registration

Add to `src/app.ts`:

```ts
import cartRoutes from '@/modules/cart/cart.routes';

app.use(`/api/${env.API_VERSION}/cart`, cartRoutes);
```
