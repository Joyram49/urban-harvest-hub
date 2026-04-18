# Garden Space Module Documentation

**Module:** `src/modules/gardenSpaces/` **Status:** ✅ Complete **Base URL:**
`/api/v1/garden-spaces`

---

## Overview

Garden spaces are individual rentable plots that live inside a farm. Each farm
can have multiple garden spaces with their own size, pricing, features, and
availability status. Customers browse and book these spaces; vendors create and
manage them. This module handles the full CRUD lifecycle plus status management
and safety guards around deletion and booking conflicts.

---

## Files

| File                        | Responsibility                                           |
| --------------------------- | -------------------------------------------------------- |
| `gardenSpace.types.ts`      | Zod schemas + inferred TS types + `IGardenSpaceResponse` |
| `gardenSpace.service.ts`    | All Prisma queries and business logic                    |
| `gardenSpace.controller.ts` | Thin HTTP handlers with Swagger JSDoc                    |
| `gardenSpace.routes.ts`     | Express Router with middleware per route                 |

---

## Database Model

```prisma
model GardenSpace {
  id            String            @id @default(cuid())
  farmId        String
  name          String
  description   String?
  size          Float                          // square meters
  pricePerMonth Decimal           @db.Decimal(10, 2)
  status        GardenSpaceStatus @default(AVAILABLE)
  imageUrl      String?
  images        String[]
  features      String[]
  maxCrops      Int?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  farm     Farm      @relation(fields: [farmId], references: [id], onDelete: Cascade)
  bookings Booking[]
}
```

### `GardenSpaceStatus` enum

| Value         | Meaning                                                     |
| ------------- | ----------------------------------------------------------- |
| `AVAILABLE`   | The space is open for booking by customers                  |
| `BOOKED`      | Actively occupied — set automatically by the Booking module |
| `MAINTENANCE` | Temporarily unavailable; vendor is doing maintenance work   |
| `INACTIVE`    | Permanently disabled by the vendor                          |

---

## API Endpoints

### Public Endpoints (no auth required)

#### `GET /api/v1/garden-spaces`

List all garden spaces. Each result includes a nested `farm` object with vendor
info.

**Query Parameters:**

| Parameter  | Type                | Description                            |
| ---------- | ------------------- | -------------------------------------- |
| `page`     | number              | Page number (default: 1)               |
| `limit`    | number              | Items per page (default: 10, max: 100) |
| `farmId`   | string              | Filter to a specific farm              |
| `status`   | `GardenSpaceStatus` | Filter by status (e.g. `AVAILABLE`)    |
| `minPrice` | number              | Minimum monthly price                  |
| `maxPrice` | number              | Maximum monthly price                  |
| `minSize`  | number              | Minimum size in sq meters              |
| `maxSize`  | number              | Maximum size in sq meters              |
| `search`   | string              | Search across name and description     |

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Garden spaces fetched successfully",
  "data": [
    {
      "id": "clx...",
      "farmId": "clx...",
      "name": "Plot A-1",
      "description": "Shaded corner plot, great for leafy greens",
      "size": 25,
      "pricePerMonth": "1200.00",
      "status": "AVAILABLE",
      "imageUrl": null,
      "images": [],
      "features": ["drip irrigation", "shade net", "raised bed"],
      "maxCrops": 3,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-01-10T08:00:00.000Z",
      "farm": {
        "id": "clx...",
        "name": "Green Valley Farm",
        "city": "Dhaka",
        "country": "Bangladesh",
        "isOrganic": true,
        "vendor": {
          "id": "clx...",
          "businessName": "Harvest Farms Ltd."
        }
      }
    }
  ],
  "meta": { "total": 18, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

#### `GET /api/v1/garden-spaces/farm/:farmId`

Get all garden spaces belonging to a specific farm (without the nested farm
object — lighter payload).

**Path Parameters:** `farmId` (string, required)

**Query Parameters:** `page`, `limit`

**Error `404`:** Farm not found.

---

#### `GET /api/v1/garden-spaces/:id`

Get full details for a single garden space, including the parent farm and
vendor.

**Path Parameters:** `id` (string, required)

**Error `404`:** Garden space not found.

---

### Protected Endpoints (auth required)

#### `POST /api/v1/garden-spaces`

Create a new garden space inside one of the vendor's farms.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR` (approved) or `ADMIN`

**Request Body:**

```json
{
  "farmId": "clx_farm_id",
  "name": "Plot B-3",
  "description": "South-facing plot with full sun exposure",
  "size": 30,
  "pricePerMonth": 1500.0,
  "features": ["drip irrigation", "composting station"],
  "maxCrops": 2
}
```

**Required Fields:** `farmId`, `name`, `size`, `pricePerMonth`

**Success Response `201`:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Garden space created successfully",
  "data": {
    /* IGardenSpaceResponse with farm */
  }
}
```

**Errors:**

- `401` — Not authenticated
- `403` — Vendor not approved, or farm belongs to a different vendor
- `404` — Farm not found
- `422` — Validation error

---

#### `PATCH /api/v1/garden-spaces/:id`

Update a garden space. Only the vendor who owns the parent farm may update it.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR` (approved) or `ADMIN`

**Path Parameters:** `id` (string, required)

**Request Body** (all fields optional):

```json
{
  "pricePerMonth": 1800.0,
  "status": "MAINTENANCE",
  "features": ["drip irrigation", "shade net", "trellis system"]
}
```

**Allowed status values via this endpoint:** `AVAILABLE`, `MAINTENANCE`,
`INACTIVE`

> ⚠️ Setting `status` to `BOOKED` is explicitly blocked — `400 Bad Request`. The
> `BOOKED` status is reserved for the Booking module.

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Garden space updated successfully",
  "data": {
    /* IGardenSpaceResponse */
  }
}
```

**Errors:**

- `400` — Attempted to set status to `BOOKED`
- `403` — Not the farm owner
- `404` — Garden space not found

---

#### `DELETE /api/v1/garden-spaces/:id`

Delete a garden space permanently.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR` (approved) or `ADMIN`

**Path Parameters:** `id` (string, required)

**Safety Guard:** Deletion is blocked if the space has any booking with status
`PENDING`, `APPROVED`, or `ACTIVE`. The vendor must cancel or complete those
bookings first.

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Garden space deleted successfully"
}
```

**Errors:**

- `400` — Space has active/pending bookings
- `403` — Not the farm owner
- `404` — Garden space not found

---

## Response Shape — `IGardenSpaceResponse`

```typescript
interface IGardenSpaceResponse {
  id: string;
  farmId: string;
  name: string;
  description: string | null;
  size: number; // square meters
  pricePerMonth: string; // Prisma Decimal → JSON string e.g. "1200.00"
  status: GardenSpaceStatus;
  imageUrl: string | null;
  images: string[];
  features: string[];
  maxCrops: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Included on single-record and list responses:
  farm?: {
    id: string;
    name: string;
    city: string;
    country: string;
    isOrganic: boolean;
    vendor: {
      id: string;
      businessName: string;
    };
  };
}
```

> **Note on `pricePerMonth`:** Prisma's `Decimal` type serialises to a string in
> JSON to avoid floating-point precision loss. Frontend code should use
> `parseFloat()` or a decimal library for arithmetic.

---

## Access Control Summary

| Endpoint                          | Public | Customer | Vendor (approved, owner) | Admin |
| --------------------------------- | :----: | :------: | :----------------------: | :---: |
| `GET /garden-spaces`              |   ✅   |    ✅    |            ✅            |  ✅   |
| `GET /garden-spaces/farm/:farmId` |   ✅   |    ✅    |            ✅            |  ✅   |
| `GET /garden-spaces/:id`          |   ✅   |    ✅    |            ✅            |  ✅   |
| `POST /garden-spaces`             |   ❌   |    ❌    |            ✅            |  ✅   |
| `PATCH /garden-spaces/:id`        |   ❌   |    ❌    |        ✅ (owner)        |  ✅   |
| `DELETE /garden-spaces/:id`       |   ❌   |    ❌    |        ✅ (owner)        |  ✅   |

---

## Business Rules

**Vendor approval gate** — Same as the Farm module. The vendor's `status` must
be `APPROVED`.

**Farm ownership** — On create, the service verifies that `farmId` refers to a
farm owned by the authenticated vendor. On update/delete, ownership is
re-verified via the space's parent farm.

**`BOOKED` status is system-managed** — Vendors cannot manually set a space to
`BOOKED`. This transition happens inside the Booking module when a booking is
activated. Attempting to do so returns `400 Bad Request`.

**Deletion safety guard** — Before deleting, the service queries for any booking
linked to the space with status `PENDING`, `APPROVED`, or `ACTIVE`. If found,
deletion is blocked with a descriptive `400` error.

**Cascade from Farm** — If a farm is deleted, all its garden spaces are
automatically deleted via `onDelete: Cascade` in the Prisma schema.

---

## Validation Rules

### Create Garden Space

| Field           | Rule                                                      |
| --------------- | --------------------------------------------------------- |
| `farmId`        | Required. Must reference a real farm owned by the vendor. |
| `name`          | Required. 2–100 characters.                               |
| `size`          | Required. Positive number (square meters).                |
| `pricePerMonth` | Required. Positive number, max 2 decimal places.          |
| `description`   | Optional. Max 1000 characters.                            |
| `features`      | Optional. Array of strings. Defaults to `[]`.             |
| `maxCrops`      | Optional. Positive integer.                               |

### Update Garden Space

All fields optional. Same rules apply. `status` must be a valid
`GardenSpaceStatus` value but `BOOKED` is blocked at the service layer.

---

## App Registration

Add to `src/app.ts`:

```typescript
import gardenSpaceRoutes from '@/modules/gardenSpaces/gardenSpace.routes';

// Inside createApp():
app.use(`/api/${env.API_VERSION}/garden-spaces`, gardenSpaceRoutes);
```

---

## Integration Points

**Booking Module** (next module) — Reads `pricePerMonth` from a space to
calculate `totalAmount`. Sets `status` to `BOOKED` when a booking becomes
`ACTIVE`, and back to `AVAILABLE` when it's `COMPLETED` or `CANCELLED`.

**Review Module** — Customers can review farms (not individual spaces). Space's
parent farm `avgRating` and `totalReviews` are updated by the Review module.

**Image Upload** (future) — `PATCH /garden-spaces/:id/images` via Multer +
Cloudinary to populate `imageUrl` and `images[]`.

---

## Future Enhancements

- **Availability calendar** — Query which date ranges a space is booked to show
  a visual calendar to customers
- **Redis caching** — Cache `GET /garden-spaces?farmId=X&status=AVAILABLE`
  results with short TTL; invalidate on create/update/delete
- **Bulk status update** — `PATCH /garden-spaces/bulk-status` for vendors to set
  multiple spaces to `MAINTENANCE` at once
- **Admin override** — Allow admins to forcibly clear a `BOOKED` status in edge
  cases
