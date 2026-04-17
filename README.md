# 🌱 Urban Harvest Hub — Backend API

An interactive urban farming platform where vendors rent garden plots, grow
produce for customers, sell organic products, and share sustainable farming
practices.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Getting Started](#getting-started)
- [Database Setup](#database-setup)
- [System Roles](#system-roles)
- [Business Flows](#business-flows)
- [API Documentation](#api-documentation)
- [Module Roadmap](#module-roadmap)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Real-Time Events](#real-time-events)

---

## Project Overview

Urban Harvest Hub combines:

- **Garden space rental** – Customers rent plots from vendors
- **Vendor-managed farming** – Vendors grow crops on behalf of customers
- **Organic marketplace** – Vendors sell verified organic produce
- **Plant tracking** – Real-time plant growth updates via Socket.IO
- **Community forum** – Sustainable farming discussions
- **Certification system** – Admin-verified organic certificates

---

## Tech Stack

| Layer         | Technology                       |
| ------------- | -------------------------------- |
| Runtime       | Node.js                          |
| Framework     | Express.js + TypeScript          |
| Database      | PostgreSQL (Supabase)            |
| ORM           | Prisma                           |
| Cache & Queue | Redis (ioredis)                  |
| Real-time     | Socket.IO                        |
| Auth          | JWT (access + refresh tokens)    |
| Validation    | Zod                              |
| File Upload   | Multer + Cloudinary              |
| API Docs      | Swagger (OpenAPI 3.0)            |
| Logging       | Winston + Morgan                 |
| Security      | Helmet, CORS, bcrypt, rate-limit |

---

## Project Structure

```
src/
├── app.ts                    # Express app factory
├── server.ts                 # Entry point & graceful shutdown
│
├── config/
│   ├── env.ts                # Zod-validated environment variables
│   ├── prisma.ts             # Prisma client singleton
│   ├── redis.ts              # Redis client + helpers
│   ├── socket.ts             # Socket.IO setup + emit helpers
│   ├── logger.ts             # Winston logger
│   └── swagger.ts            # OpenAPI spec config
│
├── modules/
│   ├── auth/                 # Register, login, refresh, logout, OTP
│   ├── users/                # Profile, avatar, change password
│   ├── vendors/              # Vendor profile + approval
│   ├── farms/                # Farm CRUD + geo search
│   ├── gardenSpaces/         # Plot CRUD + availability
│   ├── bookings/             # Booking lifecycle management
│   ├── plantTracking/        # Growth stages + updates
│   ├── products/             # Marketplace product CRUD
│   ├── cart/                 # Cart management
│   ├── orders/               # Order placement + status
│   ├── certifications/       # Organic cert upload + review
│   ├── forum/                # Posts, comments, reactions
│   ├── notifications/        # In-app notification system
│   ├── reviews/              # Vendor/farm/product reviews
│   └── admin/                # Admin-only controls
│
├── middlewares/
│   ├── auth.middleware.ts     # JWT verification
│   ├── rbac.middleware.ts     # Role-based access control
│   ├── errorHandler.middleware.ts
│   ├── notFound.middleware.ts
│   ├── rateLimiter.middleware.ts
│   └── validate.middleware.ts # Zod schema validation
│
├── utils/
│   ├── response.util.ts      # sendSuccess / sendError helpers
│   ├── asyncHandler.util.ts  # Wraps async handlers
│   └── pagination.util.ts    # Page/limit/skip helpers
│
├── constants/
│   ├── http.constants.ts     # HTTP status codes
│   └── messages.constants.ts # Reusable response messages
│
├── interfaces/
│   ├── response.interface.ts # ApiResponse, ApiMeta types
│   └── request.interface.ts  # AuthenticatedRequest
│
└── errors/
    └── AppError.ts           # AppError + HTTP error subclasses
```

---

## Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable                 | Description                                 |
| ------------------------ | ------------------------------------------- |
| `DATABASE_URL`           | Supabase PostgreSQL connection string       |
| `DIRECT_URL`             | Supabase direct connection (for migrations) |
| `REDIS_URL`              | Redis connection string                     |
| `JWT_ACCESS_SECRET`      | Min 32-char secret for access tokens        |
| `JWT_REFRESH_SECRET`     | Min 32-char secret for refresh tokens       |
| `JWT_ACCESS_EXPIRES_IN`  | Access token TTL (e.g. `15m`)               |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g. `7d`)               |
| `CORS_ORIGIN`            | Frontend URL(s), comma-separated            |
| `CLOUDINARY_*`           | Cloudinary credentials for file uploads     |
| `SMTP_*`                 | SMTP credentials for email                  |

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- A Supabase project (PostgreSQL)
- Redis instance (local or cloud)

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

### Lint & Format

```bash
npm run lint          # Check ESLint issues
npm run lint:fix      # Auto-fix ESLint issues
npm run format        # Format with Prettier
npm run format:check  # Check formatting
```

---

## Database Setup

### 1. Push schema to Supabase

```bash
npm run prisma:migrate   # Create & apply migration
# or for quick prototyping:
npx prisma db push
```

### 2. Generate Prisma client

```bash
npm run prisma:generate
```

### 3. Open Prisma Studio (optional)

```bash
npm run prisma:studio
```

### Database Seeding (coming soon)

```bash
npx prisma db seed
```

---

## System Roles

| Role         | Capabilities                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------- |
| **ADMIN**    | Approve vendors, review certifications, suspend users, moderate forum                           |
| **VENDOR**   | Create farms/spaces, accept bookings, manage plant growth, sell products, upload certifications |
| **CUSTOMER** | Rent plots, purchase products, receive plant updates, join forum, leave reviews                 |

---

## Business Flows

### Vendor-Managed Farming Flow

```
Vendor creates farm
  → Vendor creates garden spaces (with pricing)
    → Customer searches & books a plot
      → Vendor accepts booking
        → Vendor starts plant tracking (stages: SEED → HARVEST_READY)
          → Vendor adds plant updates (with images)
            → Customer receives real-time notifications
              → Vendor notifies customer of any extra costs
                → Customer approves/pays
                  → Harvest → Customer receives produce
```

### Marketplace Flow

```
Vendor adds product (with stock)
  → Customer browses products
    → Customer adds to cart
      → Customer places order
        → Vendor confirms & prepares
          → Order shipped → delivered
```

### Certification Flow

```
Vendor uploads organic certificate (PDF/image)
  → Admin reviews submission
    → Admin approves or rejects
      → Approved vendors' products show "Certified Organic" badge
```

---

## API Documentation

Swagger UI is available at:

```
http://localhost:5000/api-docs
```

Health check:

```
GET http://localhost:5000/health
```

---

## Module Roadmap

| #   | Module                   | Status     |
| --- | ------------------------ | ---------- |
| 1   | Project Setup            | ✅ Done    |
| 2   | Prisma Setup             | ✅ Done    |
| 3   | PostgreSQL (Supabase)    | ✅ Done    |
| 4   | Redis                    | ✅ Done    |
| 5   | Express Server           | ✅ Done    |
| 6   | Auth Module              | ✅ Done    |
| 7   | User Module              | 🔜 Next    |
| 8   | Vendor Module            | ⏳ Pending |
| 9   | Farm Module              | ⏳ Pending |
| 10  | Garden Space Module      | ⏳ Pending |
| 11  | Booking Module           | ⏳ Pending |
| 12  | Plant Tracking Module    | ⏳ Pending |
| 13  | Product Module           | ⏳ Pending |
| 14  | Cart Module              | ⏳ Pending |
| 15  | Order Module             | ⏳ Pending |
| 16  | Certification Module     | ⏳ Pending |
| 17  | Forum Module             | ⏳ Pending |
| 18  | Notification Module      | ⏳ Pending |
| 19  | Review Module            | ⏳ Pending |
| 20  | Swagger Docs             | ⏳ Pending |
| 21  | Socket.IO Integration    | ⏳ Pending |
| 22  | Rate Limiting            | ✅ Done    |
| 23  | Logging & Error Handling | ✅ Done    |

---

## Response Format

All API responses follow a unified structure:

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": { ... }
}
```

### Paginated Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Farms fetched successfully",
  "data": [ ... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

---

## Error Handling

Custom error classes available in `src/errors/AppError.ts`:

| Class                  | Status Code |
| ---------------------- | ----------- |
| `BadRequestError`      | 400         |
| `UnauthorizedError`    | 401         |
| `ForbiddenError`       | 403         |
| `NotFoundError`        | 404         |
| `ConflictError`        | 409         |
| `ValidationError`      | 422         |
| `TooManyRequestsError` | 429         |
| `InternalServerError`  | 500         |

**Usage:**

```ts
import { NotFoundError } from '@/errors/AppError';

throw new NotFoundError('Farm not found');
```

The global error handler (`errorHandler.middleware.ts`) also handles:

- **Zod** validation errors → 422
- **Prisma** constraint violations (P2002 → 409, P2025 → 404, P2003 → 400)
- Unhandled errors → 500 (with stack trace in development)

---

## Real-Time Events

Socket.IO events (to be expanded per module):

| Event                    | Direction       | Description                |
| ------------------------ | --------------- | -------------------------- |
| `booking:status_changed` | Server → Client | Booking approved/cancelled |
| `plant:update_added`     | Server → Client | New plant growth update    |
| `order:status_changed`   | Server → Client | Order status update        |
| `notification:new`       | Server → Client | New in-app notification    |
| `forum:comment_added`    | Server → Client | New comment on a post      |

**Joining user room (client-side):**

```js
socket.emit('join:room', `user:${userId}`);
```

---

## Import Aliases

TypeScript path aliases configured in `tsconfig.json`:

```ts
import { env } from '@/config/env';
import { sendSuccess } from '@/utils/response.util';
import { asyncHandler } from '@/utils/asyncHandler.util';
import { NotFoundError } from '@/errors/AppError';
import { MESSAGES } from '@/constants/messages.constants';
```
