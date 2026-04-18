# 🌱 Urban Harvest Hub — Backend API

> A production-ready backend for an interactive urban farming platform where vendors rent garden plots, grow produce for customers, sell organic products, and share sustainable farming practices.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Environment Setup](#-environment-setup)
- [Getting Started](#-getting-started)
- [Database Setup](#-database-setup)
- [System Roles](#-system-roles)
- [Business Flows](#-business-flows)
- [API Reference](#-api-reference)
- [Real-Time Events](#-real-time-events)
- [Notification System](#-notification-system)
- [Response Format](#-response-format)
- [Error Handling](#-error-handling)
- [Security Features](#-security-features)
- [Module Roadmap](#-module-roadmap)
- [Import Aliases](#-import-aliases)

---

## 🌿 Project Overview

Urban Harvest Hub combines five platform pillars into one cohesive backend:

| Pillar | Description |
|---|---|
| **Garden Space Rental** | Customers search, book, and rent farm plots from vendors |
| **Vendor-Managed Farming** | Vendors grow crops on behalf of customers with full lifecycle tracking |
| **Organic Marketplace** | Vendors list and sell verified organic produce directly to customers |
| **Plant Tracking** | Real-time plant stage updates pushed via Socket.IO |
| **Community Forum** | Threaded posts, emoji reactions, nested comments, and moderation |
| **Certification System** | Admin-reviewed organic certificates that unlock certified product badges |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js 5 + TypeScript 6 |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Cache / Blacklist | Redis via `ioredis` |
| Real-time | Socket.IO 4 |
| Authentication | JWT — access + refresh token rotation |
| Validation | Zod 4 |
| File Upload | Multer + Cloudinary |
| Email | Nodemailer (SMTP) with HTML templates |
| Payments | Stripe |
| API Docs | Swagger UI Express (OpenAPI 3.0) |
| Logging | Winston + Morgan |
| Security | Helmet, CORS, `express-rate-limit`, bcrypt, HPP |

---

## 📁 Project Structure

```
urban-harvest-hub/
├── prisma/
│   ├── schema.prisma             # Full DB schema (19 models, 15 enums)
│   └── migrations/
│
├── src/
│   ├── app.ts                    # Express app factory + middleware stack
│   ├── server.ts                 # HTTP server, Socket.IO init, graceful shutdown
│   │
│   ├── config/
│   │   ├── env.ts                # Zod-validated environment variables
│   │   ├── prisma.ts             # Prisma client singleton + pg pool adapter
│   │   ├── redis.ts              # Redis client + get/set/del/ttl helpers
│   │   ├── socket.ts             # Socket.IO setup + socketEmit helpers
│   │   ├── email.ts              # Nodemailer transporter + IEmailJobData
│   │   ├── logger.ts             # Winston (dev: colorized, prod: JSON)
│   │   └── swagger.ts            # OpenAPI 3.0 spec + tag registry
│   │
│   ├── modules/
│   │   ├── auth/                 # JWT auth, OTP email verification, token rotation
│   │   ├── users/                # Profile CRUD, avatar, change password
│   │   ├── vendors/              # Vendor profile + admin approval flow
│   │   ├── farms/                # Farm CRUD + location/organic filtering
│   │   ├── gardenSpaces/         # Plot CRUD, pricing, availability status
│   │   ├── bookings/             # Full booking lifecycle + extra costs
│   │   ├── plantTracking/        # Growth stage tracking + update images
│   │   ├── products/             # Marketplace product CRUD + stock management
│   │   ├── cart/                 # Cart + line item management
│   │   ├── orders/               # Order placement, status flow, payment status
│   │   ├── certifications/       # Cert upload + admin approve/reject
│   │   ├── forum/                # Posts, nested comments, reactions, reports
│   │   ├── notifications/        # In-app notifications + Socket.IO push
│   │   └── reviews/              # Vendor / farm / product reviews ⏳
│   │
│   ├── middlewares/
│   │   ├── errorHandler.middleware.ts   # Global error handler (AppError + Prisma + JWT)
│   │   ├── notFound.middleware.ts       # 404 catch-all
│   │   ├── rateLimiter.middleware.ts    # General + auth-specific rate limits
│   │   └── validate.middleware.ts       # Zod schema validation factory
│   │
│   ├── utils/
│   │   ├── response.util.ts      # sendSuccess / sendError / buildMeta / sendCreated
│   │   ├── asyncHandler.util.ts  # Wraps async controllers, forwards errors to next()
│   │   └── pagination.ts         # getPaginationOptions — page / limit / skip
│   │
│   ├── constants/
│   │   ├── http.constants.ts     # HTTP_STATUS enum
│   │   ├── messages.constants.ts # MESSAGES — reusable string literals per module
│   │   └── index.ts              # PASSWORD min/max constants
│   │
│   ├── interfaces/
│   │   ├── response.interface.ts # IApiResponse, IApiMeta, IApiError
│   │   └── request.interface.ts  # IAuthenticatedRequest, IAuthenticatedUser
│   │
│   ├── errors/
│   │   └── AppError.ts           # AppError base + 8 HTTP subclasses
│   │
│   └── templates/
│       └── emails/
│           ├── verify-email.html
│           ├── verify-email-vendor.html
│           ├── reset-password.html
│           └── password-changed.html
│
├── .env.example
├── eslint.config.mjs             # Flat ESLint config (TS strict + security + import)
├── .prettierrc
├── nodemon.json
├── prisma.config.ts
└── tsconfig.json                 # Path aliases: @/* → src/*
```

---

## ⚙️ Environment Setup

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | Server port (default `5000`) |
| `API_VERSION` | API prefix (default `v1`) |
| `FRONTEND_URL` | Frontend origin for CORS + email links |
| `DATABASE_URL` | Supabase / PostgreSQL connection string |
| `DIRECT_URL` | Supabase direct URL (bypasses pooler, needed for migrations) |
| `REDIS_URL` | Redis connection string (default `redis://localhost:6379`) |
| `JWT_ACCESS_SECRET` | Min 32-char secret for access tokens |
| `JWT_REFRESH_SECRET` | Min 32-char secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL — e.g. `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL — e.g. `7d` |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor (default `12`) |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default `900000`) |
| `RATE_LIMIT_MAX` | Max requests per window (default `100`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address |
| `MAIL_FROM_NAME` | Display name for outgoing emails |
| `MAIL_FROM_ADDRESS` | From address for outgoing emails |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL (Supabase recommended)
- Redis (local or cloud)

### Install

```bash
npm install
```

### Development

```bash
npm run dev          # nodemon + ts-node with path alias support
```

### Production

```bash
npm run build        # tsc + tsc-alias
npm start            # node dist/server.js
```

### Lint & Format

```bash
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check
```

---

## 🗄️ Database Setup

```bash
# Create and apply a migration
npm run prisma:migrate

# Quick schema push (no migration file, good for prototyping)
npx prisma db push

# Regenerate the Prisma client after schema changes
npm run prisma:generate

# Open Prisma Studio (visual DB browser)
npm run prisma:studio
```

### Schema Highlights

The Prisma schema contains **19 models** and **15 enums** covering:

- **Auth:** `User`, `RefreshToken`, `OtpCode`
- **Farming:** `Vendor`, `Farm`, `GardenSpace`, `Booking`, `ExtraCost`
- **Plant Tracking:** `PlantTracking`, `PlantUpdate`
- **Marketplace:** `Category`, `Product`, `Cart`, `CartItem`, `Order`, `OrderItem`
- **Platform:** `Certification`, `ForumPost`, `ForumComment`, `ForumReaction`, `ForumReport`, `Notification`, `Review`, `AuditLog`

---

## 👥 System Roles

| Role | Key Capabilities |
|---|---|
| **ADMIN** | Approve/reject vendors, review certifications, suspend users, moderate forum posts and reports |
| **VENDOR** | Create farms and garden spaces, accept/reject bookings, manage plant growth, list and sell products, upload organic certifications |
| **CUSTOMER** | Browse and book garden plots, purchase marketplace products, receive real-time plant updates, participate in the community forum, leave reviews |

Authentication uses **JWT Bearer tokens** for all protected routes. The `authenticate` middleware verifies the access token; `authorize(...roles)` restricts by role.

---

## 🔄 Business Flows

### Vendor-Managed Farming

```
Vendor creates a Farm
  └─► Vendor adds Garden Spaces (with size, price, features)
        └─► Customer searches available plots → books a space
              └─► Vendor APPROVES booking
                    └─► Vendor initiates Plant Tracking (SEED stage)
                          └─► Vendor posts Plant Updates (stage, health, images)
                                └─► Customer receives real-time Socket.IO push
                                      └─► Vendor adds Extra Costs if needed
                                            └─► Customer reviews/approves cost
                                                  └─► Stage → HARVEST_READY
                                                        └─► Booking → COMPLETED
```

### Organic Marketplace

```
Vendor creates Product (with stock, price, category)
  └─► Customer browses → adds to Cart
        └─► Customer places Order (cart snapshot → order items)
              └─► Vendor CONFIRMS → PREPARES → SHIPS
                    └─► Order → DELIVERED → Customer reviews product/vendor
```

### Certification

```
Vendor uploads Certificate (documentUrl, title, issuer, dates)
  └─► Status: PENDING → Admin reviews
        ├─► APPROVED → Vendor products display "Certified Organic" badge
        └─► REJECTED → Vendor receives reason, may re-submit
```

### Community Forum

```
Any user creates a Post (title, content, tags, images)
  └─► Other users add Comments (supports 1-level nested replies)
        └─► Post author receives notification
  └─► Users react (LIKE / LOVE / SEEDLING / FIRE / INSIGHTFUL) — toggleable
  └─► Users report Posts or Comments → Admin reviews → resolves
  └─► Admin can pin, lock, or hard-delete posts
```

---

## 📡 API Reference

**Base URL:** `http://localhost:5000/api/v1`
**Swagger UI:** `http://localhost:5000/api-docs`
**Health:** `GET http://localhost:5000/health`

> Protected routes require `Authorization: Bearer <accessToken>` header.
> Role annotations: 🔓 Public · 🔐 Any auth · 👤 Customer · 🏪 Vendor · 🛡️ Admin

---

### 🔑 Auth — `/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | 🔓 | Register new user (CUSTOMER or VENDOR role) |
| `POST` | `/auth/verify-email` | 🔓 | Verify email with 6-digit OTP |
| `POST` | `/auth/resend-otp` | 🔓 | Resend OTP (rate-limited to 5/15 min) |
| `POST` | `/auth/login` | 🔓 | Login — returns access token + sets refresh cookie |
| `POST` | `/auth/refresh-token` | 🔓 | Rotate refresh token — returns new access token |
| `POST` | `/auth/logout` | 🔐 | Revoke refresh token + clear cookie |
| `POST` | `/auth/forgot-password` | 🔓 | Send password reset OTP (max 3/15 min) |
| `POST` | `/auth/reset-password` | 🔓 | Reset password with OTP |

---

### 👤 Users — `/users`

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/users/me` | 🔐 | Get my profile |
| `PATCH` | `/users/me` | 🔐 | Update profile (name, phone, avatar) |
| `PATCH` | `/users/change-password` | 🔐 | Change password (requires current password) |

---

### 🏪 Vendors — `/vendors`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/vendors` | 🔐 | Create vendor profile (triggers admin review) |
| `GET` | `/vendors` | 🔓 | List approved vendors (paginated + filterable) |
| `GET` | `/vendors/:id` | 🔓 | Get vendor details |
| `PATCH` | `/vendors/:id` | 🏪 | Update own vendor profile |
| `PATCH` | `/vendors/admin/:id/status` | 🛡️ | Approve or reject vendor |

---

### 🌾 Farms — `/farms`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/farms` | 🏪 | Create a farm |
| `GET` | `/farms` | 🔓 | List farms (filter by city, organic status) |
| `GET` | `/farms/:id` | 🔓 | Get farm details |
| `PATCH` | `/farms/:id` | 🏪 | Update farm (own only) |
| `DELETE` | `/farms/:id` | 🏪 | Delete farm (own only) |

---

### 🪴 Garden Spaces — `/garden-spaces`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/garden-spaces` | 🏪 | Create a rentable plot |
| `GET` | `/garden-spaces` | 🔓 | List spaces (filter by farm, status, price) |
| `GET` | `/garden-spaces/:id` | 🔓 | Get space details |
| `PATCH` | `/garden-spaces/:id` | 🏪 | Update space |
| `DELETE` | `/garden-spaces/:id` | 🏪 | Delete space |

---

### 📅 Bookings — `/bookings`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/bookings` | 👤 | Create a booking request |
| `GET` | `/bookings` | 🔐 | List bookings (customer sees own; vendor sees their spaces') |
| `GET` | `/bookings/:id` | 🔐 | Get booking details |
| `PATCH` | `/bookings/:id/status` | 🏪 🛡️ | Update status (APPROVED / REJECTED / ACTIVE / COMPLETED / CANCELLED) |
| `POST` | `/bookings/:id/extra-costs` | 🏪 | Add extra cost to a booking |

---

### 🌱 Plant Tracking — `/plants`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/plants` | 🏪 | Initiate plant tracking for a booking |
| `GET` | `/plants` | 🔐 | List tracked plants |
| `GET` | `/plants/:id` | 🔐 | Get tracking detail with all updates |
| `POST` | `/plants/:id/updates` | 🏪 | Add a plant update (stage, health, images) |

---

### 🛒 Products — `/products`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/products` | 🏪 | Create a product |
| `GET` | `/products` | 🔓 | List products (filter by category, vendor, organic, certified) |
| `GET` | `/products/:id` | 🔓 | Get product details |
| `PATCH` | `/products/:id` | 🏪 | Update product or adjust stock |
| `DELETE` | `/products/:id` | 🏪 | Archive product |

---

### 🛍️ Cart — `/cart`

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/cart` | 👤 | Get my cart |
| `POST` | `/cart` | 👤 | Add item to cart (or update quantity if exists) |
| `PATCH` | `/cart/items/:id` | 👤 | Update item quantity |
| `DELETE` | `/cart/items/:id` | 👤 | Remove item from cart |

---

### 📦 Orders — `/orders`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/orders` | 👤 | Place order from cart |
| `GET` | `/orders` | 🔐 | List orders (customer sees own; vendor sees their items') |
| `GET` | `/orders/:id` | 🔐 | Get order with all items |
| `PATCH` | `/orders/:id/status` | 🏪 🛡️ | Update order status |

---

### 📜 Certifications — `/certifications`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/certifications` | 🏪 | Upload a certification (status: PENDING) |
| `GET` | `/certifications/my` | 🏪 | List my certifications (paginated) |
| `GET` | `/certifications/:id` | 🏪 🛡️ | Get certification detail |
| `DELETE` | `/certifications/:id` | 🏪 | Delete (PENDING only) |
| `GET` | `/certifications/admin` | 🛡️ | List all certs (filter by status, vendorId) |
| `PATCH` | `/certifications/admin/:id/review` | 🛡️ | Approve or reject |

---

### 💬 Forum — `/forum`

#### Posts

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/forum/posts` | 🔓 | List posts (search, tag, author filter; pinned first) |
| `GET` | `/forum/posts/:id` | 🔓 | Get post with nested comments + reaction summary |
| `POST` | `/forum/posts` | 🔐 | Create post |
| `PATCH` | `/forum/posts/:id` | 🔐 | Update own post (admin can edit any) |
| `DELETE` | `/forum/posts/:id` | 🔐 | Delete own post (admin can delete any) |

#### Comments

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/forum/posts/:id/comments` | 🔐 | Add comment (supports `parentId` for 1-level replies) |
| `PATCH` | `/forum/comments/:commentId` | 🔐 | Update own comment |
| `DELETE` | `/forum/comments/:commentId` | 🔐 | Delete own comment (admin can delete any) |

#### Reactions

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/forum/posts/:id/reactions` | 🔐 | React / toggle (same type = remove, different = update) |
| `GET` | `/forum/posts/:id/reactions` | 🔓 | Get reaction counts by type |

#### Reports & Moderation

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/forum/posts/:id/report` | 🔐 | Report a post |
| `POST` | `/forum/comments/:commentId/report` | 🔐 | Report a comment |
| `PATCH` | `/forum/admin/posts/:id/moderate` | 🛡️ | Pin or lock a post |
| `DELETE` | `/forum/admin/posts/:id` | 🛡️ | Hard delete a post |
| `DELETE` | `/forum/admin/comments/:commentId` | 🛡️ | Hard delete a comment |
| `GET` | `/forum/admin/reports` | 🛡️ | List all reports (filter by `isResolved`) |
| `PATCH` | `/forum/admin/reports/:reportId/resolve` | 🛡️ | Resolve a report |

---

### 🔔 Notifications — `/notifications`

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/notifications` | 🔐 | List my notifications (filter by type, isRead) |
| `GET` | `/notifications/unread-count` | 🔐 | Unread badge count |
| `PATCH` | `/notifications/read-all` | 🔐 | Mark all as read |
| `PATCH` | `/notifications/:id/read` | 🔐 | Mark one as read |
| `DELETE` | `/notifications/:id` | 🔐 | Delete one notification |
| `DELETE` | `/notifications/clear-all` | 🔐 | Clear all notifications |

---

### ⭐ Reviews — `/reviews` ⏳

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/reviews` | 👤 | Submit a review (target: VENDOR / FARM / PRODUCT) |
| `GET` | `/reviews` | 🔓 | List reviews (filter by targetType + targetId) |

---

## ⚡ Real-Time Events

Socket.IO is initialized on the HTTP server. Clients must join their personal room after login.

### Client → Server

```js
// Join personal notification room after login
socket.emit('join:room', `user:${userId}`);

// Join a forum post room to receive live comments
socket.emit('join:room', `forum:post:${postId}`);

// Leave a room
socket.emit('leave:room', roomId);
```

### Server → Client Events

| Event | Room | Payload | Fired when |
|---|---|---|---|
| `notification:new` | `user:{userId}` | Full notification object | Any notification is created for the user |
| `forum:comment:new` | `forum:post:{postId}` | `{ postId, comment }` | A comment is added to a post |

### Notification Types

| Type | Trigger |
|---|---|
| `BOOKING_UPDATE` | Booking created, status changed, extra cost added |
| `PLANT_UPDATE` | Plant update added, or stage reaches `HARVEST_READY` |
| `ORDER_UPDATE` | Order placed, status changes (CONFIRMED → DELIVERED / CANCELLED) |
| `PAYMENT_UPDATE` | Payment status → PAID |
| `CERTIFICATION_UPDATE` | Admin approves or rejects a certification |
| `FORUM_ACTIVITY` | Someone comments on or reacts to your post |
| `SYSTEM` | Vendor approved/rejected, account suspended |

---

## 🔔 Notification System

The notification system is a **dual-channel** architecture:

1. **Persistence** — every notification is written to the `notifications` table
2. **Real-time push** — immediately emitted to `user:{userId}` via Socket.IO

All other modules fire notifications via a single shared helper:

```ts
import { createNotification } from '@/modules/notifications/notification.service';
import { NotificationType } from '@prisma/client';

// Call this AFTER your primary DB write succeeds
// It has internal try/catch — will never crash the calling service
await createNotification({
  userId: recipientId,
  type: NotificationType.BOOKING_UPDATE,
  title: 'Booking Approved 🎉',
  message: 'Your garden space booking has been approved.',
  actionUrl: `/bookings/${booking.id}`,
  data: { bookingId: booking.id },
});
```

---

## 📐 Response Format

All endpoints return a unified JSON structure.

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": { }
}
```

### Paginated

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Posts fetched successfully",
  "data": [],
  "meta": {
    "total": 84,
    "page": 2,
    "limit": 10,
    "totalPages": 9
  }
}
```

### Error

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "body.email", "message": "Invalid email address" },
    { "field": "body.password", "message": "Password must contain at least one uppercase letter" }
  ]
}
```

---

## 🚨 Error Handling

Custom error classes in `src/errors/AppError.ts`:

| Class | Status | Use case |
|---|---|---|
| `BadRequestError` | 400 | Invalid input that passed validation |
| `UnauthorizedError` | 401 | Missing or invalid token |
| `ForbiddenError` | 403 | Authenticated but insufficient role |
| `NotFoundError` | 404 | Resource does not exist |
| `ConflictError` | 409 | Duplicate resource (email, slug, etc.) |
| `ValidationError` | 422 | Zod schema failures |
| `TooManyRequestsError` | 429 | Rate limit exceeded |
| `InternalServerError` | 500 | Unexpected failures |

The global error handler (`errorHandler.middleware.ts`) additionally maps:

| Error type | Response |
|---|---|
| `Prisma P2002` (unique constraint) | 409 Conflict |
| `Prisma P2025` (record not found) | 404 Not Found |
| `Prisma P2003` (foreign key) | 400 Bad Request |
| `jwt.TokenExpiredError` | 401 Unauthorized |
| `jwt.JsonWebTokenError` | 401 Unauthorized |
| `SyntaxError` (bad JSON body) | 400 Bad Request |

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt with configurable salt rounds (default: 12) |
| Access tokens | Short-lived JWT (default 15 min), verified on every protected request |
| Refresh token rotation | Old token revoked + blacklisted in Redis on every rotation |
| Token blacklist | Revoked refresh tokens stored in Redis until their natural expiry |
| OTP security | SHA-256 hashed before storage, 10-min TTL, max 5 wrong attempts before lock |
| Rate limiting | General: 100 req / 15 min; Auth endpoints: 10 req / 15 min |
| Helmet | Sets 15 security-related HTTP headers |
| CORS | Strict origin allowlist from `CORS_ORIGIN` env var |
| HPP | HTTP parameter pollution protection |
| Input validation | Every request body/query/params validated with Zod before handler runs |
| User enumeration prevention | Forgot-password and login return identical messages regardless of existence |
| RBAC | `authenticate` + `authorize(...roles)` middleware chain on every protected route |
| httpOnly cookies | Refresh token stored in `httpOnly; SameSite` cookie, never in JS-accessible storage |

---

## ✅ Module Roadmap

| # | Module | Status | Key Features |
|---|---|---|---|
| 1 | Project Setup | ✅ Done | TypeScript, ESLint, Prettier, path aliases |
| 2 | Prisma Setup | ✅ Done | 19 models, 15 enums, PG adapter |
| 3 | PostgreSQL (Supabase) | ✅ Done | Connection pooling via `pg` Pool |
| 4 | Redis | ✅ Done | Token blacklist, OTP rate limiting, caching |
| 5 | Express Server | ✅ Done | Graceful shutdown, SIGTERM/SIGINT handlers |
| 6 | Auth Module | ✅ Done | Register, verify email, login, refresh, logout, forgot/reset password |
| 7 | User Module | ✅ Done | Profile CRUD, avatar upload, change password |
| 8 | Vendor Module | ✅ Done | Vendor profile, admin approval/rejection flow |
| 9 | Farm Module | ✅ Done | Farm CRUD, location + organic filtering |
| 10 | Garden Space Module | ✅ Done | Plot CRUD, availability management |
| 11 | Booking Module | ✅ Done | Full lifecycle: PENDING → APPROVED → ACTIVE → COMPLETED, extra costs |
| 12 | Plant Tracking Module | ✅ Done | Growth stages, health status, update images |
| 13 | Product Module | ✅ Done | Marketplace CRUD, stock management, category support |
| 14 | Cart Module | ✅ Done | Add / update / remove items, one cart per user |
| 15 | Order Module | ✅ Done | Checkout from cart, status flow, payment status |
| 16 | Certification Module | ✅ Done | Upload, admin review (approve/reject), vendor delete (PENDING only) |
| 17 | Forum Module | ✅ Done | Posts, 1-level nested comments, 5 reaction types, reports, admin moderation |
| 18 | Notification Module | ✅ Done | DB persistence + Socket.IO push, 7 notification types, read/clear API |
| 19 | Review Module | ⏳ Pending | Vendor / farm / product reviews with rating aggregation |
| 20 | Swagger Docs | ✅ Done | JSDoc annotations on all controllers, full OpenAPI 3.0 spec |
| 21 | Socket.IO Integration | ✅ Done | User rooms, forum post rooms, `socketEmit` helpers |
| 22 | Rate Limiting | ✅ Done | General + strict auth limiter |
| 23 | Logging & Error Handling | ✅ Done | Winston (colorized dev / JSON prod), global error handler |

---

## 🗂️ Import Aliases

TypeScript path aliases are configured in `tsconfig.json` and resolved at runtime by `tsconfig-paths` (dev) and `tsc-alias` (build):

```ts
import { env }           from '@/config/env';
import { prisma }        from '@/config/prisma';
import { redis }         from '@/config/redis';
import { socketEmit }    from '@/config/socket';
import { logger }        from '@/config/logger';
import { sendSuccess }   from '@/utils/response.util';
import { asyncHandler }  from '@/utils/asyncHandler.util';
import { getPaginationOptions } from '@/utils/pagination';
import { NotFoundError } from '@/errors/AppError';
import { MESSAGES }      from '@/constants/messages.constants';
import { HTTP_STATUS }   from '@/constants/http.constants';
import { authenticate, authorize, isAdmin, isVendor, isAdminOrVendor } from '@/modules/auth/auth.middleware';
```