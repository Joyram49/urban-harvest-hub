# 🛒 Product Module — Urban Harvest Hub

## Overview

The Product Module enables vendors to list and manage organic produce and
farming-related items in the marketplace. It supports full CRUD for both
**categories** (Admin-managed) and **products** (Vendor-managed), with
filtering, search, soft-delete, and automatic stock-status transitions.

---

## Table of Contents

- [Module Files](#module-files)
- [Database Models](#database-models)
- [Business Rules](#business-rules)
- [API Endpoints](#api-endpoints)
  - [Category Endpoints](#category-endpoints)
  - [Product Endpoints](#product-endpoints)
- [Request & Response Schemas](#request--response-schemas)
- [Error Reference](#error-reference)
- [Access Control Summary](#access-control-summary)

---

## Module Files

| File                    | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `product.types.ts`      | Zod validation schemas + inferred TypeScript types + response interfaces |
| `product.service.ts`    | All business logic, Prisma queries, slug generation, ownership checks    |
| `product.controller.ts` | Thin HTTP handlers — calls service, calls `sendSuccess`                  |
| `product.routes.ts`     | Express Router with `validate()`, `authenticate`, and RBAC middleware    |

---

## Database Models

### `Category`

| Column        | Type       | Notes                                                     |
| ------------- | ---------- | --------------------------------------------------------- |
| `id`          | `cuid`     | Primary key                                               |
| `name`        | `String`   | Unique display name                                       |
| `slug`        | `String`   | Unique URL-safe identifier, auto-generated from name      |
| `description` | `String?`  | Optional                                                  |
| `imageUrl`    | `String?`  | Optional banner image                                     |
| `isActive`    | `Boolean`  | Soft-toggle; only active categories are returned publicly |
| `sortOrder`   | `Int`      | Controls display order (ascending)                        |
| `createdAt`   | `DateTime` | Auto                                                      |
| `updatedAt`   | `DateTime` | Auto                                                      |

### `Product`

| Column         | Type             | Notes                                                                |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| `id`           | `cuid`           | Primary key                                                          |
| `vendorId`     | `String`         | FK → `vendors.id`                                                    |
| `categoryId`   | `String`         | FK → `categories.id`                                                 |
| `name`         | `String`         | Display name                                                         |
| `slug`         | `String`         | Unique URL-safe identifier (name + 5-char random suffix)             |
| `description`  | `String?`        | Optional                                                             |
| `price`        | `Decimal(10,2)`  | Selling price                                                        |
| `comparePrice` | `Decimal(10,2)?` | Strike-through "was" price                                           |
| `stock`        | `Int`            | Current inventory count                                              |
| `lowStockAt`   | `Int`            | Threshold that triggers low-stock warning (default: 5)               |
| `unit`         | `String`         | e.g. `piece`, `kg`, `bunch` (default: `piece`)                       |
| `imageUrl`     | `String?`        | Primary image                                                        |
| `images`       | `String[]`       | Additional gallery images (max 10)                                   |
| `isCertified`  | `Boolean`        | Set by certification approval flow — not editable by vendor directly |
| `isOrganic`    | `Boolean`        | Vendor-declared organic status                                       |
| `status`       | `ProductStatus`  | `ACTIVE`, `OUT_OF_STOCK`, `ARCHIVED`                                 |
| `avgRating`    | `Float`          | Computed by Review module                                            |
| `totalReviews` | `Int`            | Computed by Review module                                            |
| `totalSold`    | `Int`            | Incremented by Order module                                          |
| `createdAt`    | `DateTime`       | Auto                                                                 |
| `updatedAt`    | `DateTime`       | Auto                                                                 |

### `ProductStatus` Enum

| Value          | Meaning                     |
| -------------- | --------------------------- |
| `ACTIVE`       | Listed and purchasable      |
| `OUT_OF_STOCK` | Visible but not purchasable |
| `ARCHIVED`     | Hidden — soft-deleted       |

---

## Business Rules

### Categories

- Only **Admins** can create or modify categories.
- Slug is auto-generated from the name on creation and on rename. Duplicate
  slugs cause a `400 Bad Request`.
- Public queries only return categories where `isActive = true`. Admins can
  toggle `isActive` to hide/show categories without deleting them.

### Products

- Only **approved Vendors** can create products. Vendors with `PENDING`,
  `REJECTED`, or `SUSPENDED` status receive a `403 Forbidden`.
- The `categoryId` must point to an active category; inactive categories block
  listing.
- **Slug** is auto-generated as `{sanitized-name}-{5-char-random}` to avoid
  collisions on rename.
- **Stock → Status** transitions are automatic:
  - Creating or updating with `stock = 0` sets `status = OUT_OF_STOCK`.
  - Creating or updating with `stock > 0` sets `status = ACTIVE`.
  - An explicit `status: ARCHIVED` in the update body takes precedence.
- **Soft delete** — `DELETE /products/:id` sets `status = ARCHIVED`. The product
  remains in the database to preserve historical order data.
- `isCertified` is managed externally by the Certification module and cannot be
  patched directly by the vendor.
- Public listing (`GET /products`) excludes `ARCHIVED` products unless a
  specific `status` filter is provided.
- Vendors can only update or delete **their own** products. Attempting to modify
  another vendor's product returns `403 Forbidden`.

---

## API Endpoints

Base path: `/api/v1`

### Category Endpoints

#### `POST /products/categories`

Create a new product category.

**Auth:** Required — Admin only

**Request Body:**

```json
{
  "name": "Vegetables",
  "description": "Fresh seasonal vegetables",
  "imageUrl": "https://example.com/veg.jpg",
  "sortOrder": 1
}
```

**Success Response `201`:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Category created successfully",
  "data": {
    "id": "clx...",
    "name": "Vegetables",
    "slug": "vegetables",
    "description": "Fresh seasonal vegetables",
    "imageUrl": "https://example.com/veg.jpg",
    "isActive": true,
    "sortOrder": 1,
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:00:00.000Z"
  }
}
```

---

#### `GET /products/categories`

Fetch all active categories, ordered by `sortOrder` then name.

**Auth:** None

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Categories fetched successfully",
  "data": [
    {
      "id": "clx...",
      "name": "Vegetables",
      "slug": "vegetables",
      "description": null,
      "imageUrl": null,
      "isActive": true,
      "sortOrder": 1,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

#### `GET /products/categories/:id`

Fetch a single category by ID.

**Auth:** None

---

#### `PATCH /products/categories/:id`

Update a category.

**Auth:** Required — Admin only

**Request Body** (all fields optional, at least one required):

```json
{
  "name": "Leafy Greens",
  "isActive": false,
  "sortOrder": 2
}
```

---

### Product Endpoints

#### `POST /products`

Create a new product listing.

**Auth:** Required — Vendor only (status must be `APPROVED`)

**Request Body:**

```json
{
  "categoryId": "clx...",
  "name": "Organic Tomatoes",
  "description": "Sun-ripened cherry tomatoes, pesticide-free.",
  "price": 3.5,
  "comparePrice": 5.0,
  "stock": 120,
  "lowStockAt": 10,
  "unit": "kg",
  "imageUrl": "https://cdn.example.com/tomatoes.jpg",
  "images": [],
  "isOrganic": true
}
```

**Success Response `201`:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": "clx...",
    "vendorId": "v1...",
    "categoryId": "c1...",
    "name": "Organic Tomatoes",
    "slug": "organic-tomatoes-a7f2k",
    "description": "Sun-ripened cherry tomatoes, pesticide-free.",
    "price": "3.50",
    "comparePrice": "5.00",
    "stock": 120,
    "lowStockAt": 10,
    "unit": "kg",
    "imageUrl": "https://cdn.example.com/tomatoes.jpg",
    "images": [],
    "isCertified": false,
    "isOrganic": true,
    "status": "ACTIVE",
    "avgRating": 0,
    "totalReviews": 0,
    "totalSold": 0,
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:00:00.000Z",
    "category": { "id": "c1...", "name": "Vegetables", "slug": "vegetables" },
    "vendor": {
      "id": "v1...",
      "businessName": "Green Thumb Farm",
      "logoUrl": null,
      "avgRating": 0
    }
  }
}
```

---

#### `GET /products`

Browse all non-archived products with filters, search, and pagination.

**Auth:** None

**Query Parameters:**

| Param         | Type    | Default     | Description                                    |
| ------------- | ------- | ----------- | ---------------------------------------------- |
| `page`        | integer | `1`         | Page number                                    |
| `limit`       | integer | `10`        | Items per page (max 100)                       |
| `categoryId`  | string  | —           | Filter by category                             |
| `vendorId`    | string  | —           | Filter by vendor                               |
| `status`      | enum    | —           | `ACTIVE`, `OUT_OF_STOCK`                       |
| `isOrganic`   | boolean | —           | `true` / `false`                               |
| `isCertified` | boolean | —           | `true` / `false`                               |
| `minPrice`    | number  | —           | Minimum price filter                           |
| `maxPrice`    | number  | —           | Maximum price filter                           |
| `search`      | string  | —           | Searches `name` and `description`              |
| `sortBy`      | enum    | `createdAt` | `price`, `createdAt`, `avgRating`, `totalSold` |
| `sortOrder`   | enum    | `desc`      | `asc` / `desc`                                 |

**Success Response `200` (paginated):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Products fetched successfully",
  "data": [
    /* array of product objects */
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

#### `GET /products/my`

Fetch the authenticated vendor's own products (including `OUT_OF_STOCK` and
`ARCHIVED`).

**Auth:** Required — Vendor only

Accepts the same query parameters as `GET /products`.

---

#### `GET /products/:id`

Fetch a single product by its CUID.

**Auth:** None

---

#### `GET /products/slug/:slug`

Fetch a single product by its URL slug. Useful for SEO-friendly product pages.

**Auth:** None

---

#### `PATCH /products/:id`

Update a product. Vendor must own the product.

**Auth:** Required — Vendor only

**Request Body** (all fields optional, at least one required):

```json
{
  "name": "Cherry Tomatoes",
  "price": 4.0,
  "stock": 80,
  "description": "Updated description.",
  "status": "ACTIVE"
}
```

**Notes:**

- Updating `stock` to `0` automatically sets `status` to `OUT_OF_STOCK`.
- Updating `stock` to `> 0` automatically sets `status` to `ACTIVE` (unless
  explicitly set to `ARCHIVED`).
- `isCertified` cannot be updated via this endpoint.

---

#### `PATCH /products/:id/stock`

Quick stock update endpoint. Vendor must own the product.

**Auth:** Required — Vendor only

**Request Body:**

```json
{
  "stock": 200
}
```

Automatically adjusts `status` to `ACTIVE` or `OUT_OF_STOCK` based on the new
value.

---

#### `DELETE /products/:id`

Soft-delete (archive) a product. Vendor must own the product.

**Auth:** Required — Vendor only

Sets `status = ARCHIVED`. The product is removed from public listing but
preserved in the database for order history integrity.

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Product deleted successfully"
}
```

---

## Request & Response Schemas

### Validation Rules

#### `CreateProductInput`

| Field          | Rules                                          |
| -------------- | ---------------------------------------------- |
| `categoryId`   | Required string                                |
| `name`         | Required, 2–150 chars                          |
| `description`  | Optional, max 2000 chars                       |
| `price`        | Required positive number, max 2 decimal places |
| `comparePrice` | Optional positive number, max 2 decimal places |
| `stock`        | Optional integer ≥ 0, defaults to `0`          |
| `lowStockAt`   | Optional integer ≥ 1, defaults to `5`          |
| `unit`         | Optional string, defaults to `"piece"`         |
| `imageUrl`     | Optional valid URL                             |
| `images`       | Optional array of valid URLs, max 10 items     |
| `isOrganic`    | Optional boolean, defaults to `false`          |

#### `UpdateProductInput`

All fields from `CreateProductInput` are optional, plus:

| Field    | Rules                                 |
| -------- | ------------------------------------- |
| `status` | Optional enum: `ACTIVE` or `ARCHIVED` |

At least one field must be provided or a `400` is returned.

#### `GetProductsQuery`

All fields optional. `isOrganic` and `isCertified` accept the strings `"true"` /
`"false"` from the query string and are coerced to booleans.

---

## Error Reference

| Status | Scenario                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- |
| `400`  | Validation failed, slug conflict on category creation, missing required fields           |
| `401`  | Missing or invalid JWT token                                                             |
| `403`  | Non-vendor trying to create product, unapproved vendor, wrong ownership on update/delete |
| `404`  | Product or category not found, vendor profile not found                                  |
| `409`  | (Handled by global Prisma error handler on unique constraint violations)                 |

---

## Access Control Summary

| Endpoint                         | Public | Customer | Vendor        | Admin |
| -------------------------------- | ------ | -------- | ------------- | ----- |
| `GET /products/categories`       | ✅     | ✅       | ✅            | ✅    |
| `GET /products/categories/:id`   | ✅     | ✅       | ✅            | ✅    |
| `POST /products/categories`      | ❌     | ❌       | ❌            | ✅    |
| `PATCH /products/categories/:id` | ❌     | ❌       | ❌            | ✅    |
| `GET /products`                  | ✅     | ✅       | ✅            | ✅    |
| `GET /products/:id`              | ✅     | ✅       | ✅            | ✅    |
| `GET /products/slug/:slug`       | ✅     | ✅       | ✅            | ✅    |
| `GET /products/my`               | ❌     | ❌       | ✅ (own)      | ✅    |
| `POST /products`                 | ❌     | ❌       | ✅ (approved) | ❌    |
| `PATCH /products/:id`            | ❌     | ❌       | ✅ (own)      | ❌    |
| `PATCH /products/:id/stock`      | ❌     | ❌       | ✅ (own)      | ❌    |
| `DELETE /products/:id`           | ❌     | ❌       | ✅ (own)      | ❌    |

---

## Integration Points

- **Certification Module** — sets `isCertified = true` on products belonging to
  a vendor whose certification is approved.
- **Order Module** — increments `totalSold` when an order is
  confirmed/delivered.
- **Review Module** — updates `avgRating` and `totalReviews` when a product
  review is submitted.
- **Cart Module** — reads product `price`, `stock`, and `status` when adding
  items to the cart; validates stock availability at checkout.

---

## Implementation Notes

- **Slug uniqueness** — slugs include a 5-character random suffix
  (`base-name-a7f2k`) so renaming a product never conflicts with an existing
  slug.
- **Soft delete rationale** — hard-deleting a product would orphan `OrderItem`
  records. Setting `status = ARCHIVED` is safe and keeps the data auditable.
- **Decimal prices** — Prisma returns `Decimal` objects. When serialized to JSON
  they appear as strings (e.g. `"3.50"`). Frontend clients should parse them
  with `parseFloat()`.
- **`isCertified` is read-only** via this module — it is controlled by the
  Certification approval workflow.
