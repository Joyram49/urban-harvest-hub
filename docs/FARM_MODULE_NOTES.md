# Farm Module Documentation

**Module:** `src/modules/farms/` **Status:** ✅ Complete **Base URL:**
`/api/v1/farms`

---

## Overview

The Farm module lets approved vendors create and manage farm profiles on the
Urban Harvest Hub platform. Each farm is owned by a vendor and can contain
multiple garden spaces that customers can rent. The module supports full CRUD
operations with location-based filtering and text search.

---

## Files

| File                 | Responsibility                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `farm.types.ts`      | Zod schemas (create, update, list query, get, delete) + inferred TS types + `IFarmResponse` |
| `farm.service.ts`    | All Prisma queries and business logic (create, read, list, update, delete, getByVendor)     |
| `farm.controller.ts` | Thin HTTP handlers — calls service, returns `sendSuccess()`. Includes Swagger JSDoc.        |
| `farm.routes.ts`     | Express Router with `validate()` + `authenticate` + role guards per route                   |

---

## Database Model

```prisma
model Farm {
  id           String   @id @default(cuid())
  vendorId     String
  name         String
  description  String?
  address      String
  city         String
  state        String?
  country      String
  postalCode   String?
  latitude     Float?
  longitude    Float?
  imageUrl     String?
  images       String[]
  totalArea    Float?
  soilType     String?
  waterSource  String?
  isOrganic    Boolean  @default(false)
  avgRating    Float    @default(0)
  totalReviews Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Cascades: deleting a farm also deletes all its `GardenSpace` records (and their
`Booking` records) via Prisma's `onDelete: Cascade`.

---

## API Endpoints

### Public Endpoints (no auth required)

#### `GET /api/v1/farms`

List all farms with optional filtering and pagination.

**Query Parameters:**

| Parameter   | Type    | Description                                         |
| ----------- | ------- | --------------------------------------------------- |
| `page`      | number  | Page number (default: 1)                            |
| `limit`     | number  | Items per page (default: 10, max: 100)              |
| `city`      | string  | Filter by city (case-insensitive, partial match)    |
| `country`   | string  | Filter by country (case-insensitive, partial match) |
| `isOrganic` | boolean | Filter by organic status (`true` / `false`)         |
| `search`    | string  | Full-text search across name, description, city     |
| `vendorId`  | string  | Filter farms belonging to a specific vendor         |

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Farms fetched successfully",
  "data": [
    /* IFarmResponse[] */
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

#### `GET /api/v1/farms/:id`

Get a single farm by its ID.

**Path Parameters:** `id` (string, required)

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Farm fetched successfully",
  "data": {
    /* IFarmResponse */
  }
}
```

**Error `404`:** Farm not found.

---

### Protected Endpoints (auth required)

#### `POST /api/v1/farms`

Create a new farm. Requires an **approved** vendor account.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR` or `ADMIN`

**Request Body:**

```json
{
  "name": "Green Valley Farm",
  "description": "Organic farm in the heart of the city",
  "address": "123 Farm Lane",
  "city": "Dhaka",
  "state": "Dhaka Division",
  "country": "Bangladesh",
  "postalCode": "1200",
  "latitude": 23.8103,
  "longitude": 90.4125,
  "totalArea": 500,
  "soilType": "Loamy",
  "waterSource": "Borehole",
  "isOrganic": true
}
```

**Required Fields:** `name`, `address`, `city`, `country`

**Success Response `201`:**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Farm created successfully",
  "data": {
    /* IFarmResponse */
  }
}
```

**Errors:**

- `401` — Not authenticated
- `403` — Not a vendor, or vendor not yet approved
- `422` — Validation error

---

#### `PATCH /api/v1/farms/:id`

Update an existing farm. Only the vendor who owns the farm can update it.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR` or `ADMIN`

**Path Parameters:** `id` (string, required)

**Request Body** (all fields optional):

```json
{
  "name": "Updated Farm Name",
  "isOrganic": true,
  "totalArea": 750
}
```

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Farm updated successfully",
  "data": {
    /* IFarmResponse */
  }
}
```

**Errors:**

- `403` — Not the farm owner
- `404` — Farm not found

---

#### `DELETE /api/v1/farms/:id`

Delete a farm. Only the vendor who owns the farm can delete it.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR` or `ADMIN`

**Path Parameters:** `id` (string, required)

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Farm deleted successfully"
}
```

**Errors:**

- `403` — Not the farm owner
- `404` — Farm not found

---

#### `GET /api/v1/farms/my-farms`

Get all farms belonging to the currently authenticated vendor.

**Headers:** `Authorization: Bearer <accessToken>`

**Required Role:** `VENDOR`

**Query Parameters:** `page`, `limit` (same as list endpoint)

**Success Response `200`:**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Farms fetched successfully",
  "data": [
    /* IFarmResponse[] */
  ],
  "meta": { "total": 3, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

## Response Shape — `IFarmResponse`

```typescript
interface IFarmResponse {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  images: string[];
  totalArea: number | null; // in square meters
  soilType: string | null;
  waterSource: string | null;
  isOrganic: boolean;
  avgRating: number; // updated by the Review module
  totalReviews: number; // updated by the Review module
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Access Control Summary

| Endpoint              | Public | Customer | Vendor (approved) | Admin |
| --------------------- | :----: | :------: | :---------------: | :---: |
| `GET /farms`          |   ✅   |    ✅    |        ✅         |  ✅   |
| `GET /farms/:id`      |   ✅   |    ✅    |        ✅         |  ✅   |
| `GET /farms/my-farms` |   ❌   |    ❌    |        ✅         |  ❌   |
| `POST /farms`         |   ❌   |    ❌    |        ✅         |  ✅   |
| `PATCH /farms/:id`    |   ❌   |    ❌    |  ✅ (owner only)  |  ✅   |
| `DELETE /farms/:id`   |   ❌   |    ❌    |  ✅ (owner only)  |  ✅   |

---

## Business Rules

**Vendor approval gate** — A vendor must have `status = APPROVED` before they
can create or modify farms. Pending, rejected, or suspended vendors receive a
`403 Forbidden` response.

**Ownership check** — All mutating operations (update, delete) verify that the
`farm.vendorId` matches the authenticated user's vendor ID. Mismatches return
`403 Forbidden`. This applies even to ADMIN calls routed through the vendor path
— admins should use a future admin-specific bypass if needed.

**Cascade deletion** — Deleting a farm will cascade-delete all associated
`GardenSpace` records, which in turn cascade-delete their `Booking` records.
This is handled at the Prisma schema level via `onDelete: Cascade`.

**`avgRating` and `totalReviews`** — These fields are read-only in the Farm
module. They are maintained by the Review module when reviews are submitted or
deleted.

---

## Validation Rules

### Create Farm

| Field         | Rule                                    |
| ------------- | --------------------------------------- |
| `name`        | Required. 2–100 characters.             |
| `address`     | Required. Min 5 characters.             |
| `city`        | Required. Min 2 characters.             |
| `country`     | Required. Min 2 characters.             |
| `latitude`    | Optional. Must be between -90 and 90.   |
| `longitude`   | Optional. Must be between -180 and 180. |
| `totalArea`   | Optional. Must be a positive number.    |
| `description` | Optional. Max 1000 characters.          |
| `isOrganic`   | Optional. Boolean. Defaults to `false`. |

### Update Farm

All fields are optional. Same individual field rules as above apply when
provided.

---

## App Registration

Add the farm route to `src/app.ts`:

```typescript
import farmRoutes from '@/modules/farms/farm.routes';

// Inside createApp():
app.use(`/api/${env.API_VERSION}/farms`, farmRoutes);
```

---

## Future Enhancements

- **Image upload** — `PATCH /farms/:id/images` via Multer + Cloudinary (Media
  module)
- **Geospatial search** — "farms near me" using PostGIS or haversine formula
  with lat/lng bounding box
- **Redis caching** — Cache public farm listings with a short TTL; invalidate on
  create/update/delete
- **Admin override** — Allow admins to update/delete any farm regardless of
  ownership
- **Garden space count** — Include `_count.gardenSpaces` in the response for the
  listing view
