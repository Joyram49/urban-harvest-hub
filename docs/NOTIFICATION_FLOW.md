# Notification System — Complete Flow Documentation

## Overview

The notification system in Urban Harvest Hub is a **dual-channel** system:

1. **Database persistence** — every notification is written to the
   `notifications` table so users can retrieve their history at any time.
2. **Real-time push** — every notification is immediately emitted via
   **Socket.IO** to the recipient's personal room (`user:{userId}`) so the
   frontend can react instantly (badge update, toast, etc).

The system is built around a **single shared helper** — `createNotification()` —
that all other modules call. This means:

- Zero circular dependencies (notification module depends on nothing
  domain-specific)
- Consistent shape for every notification
- A notification failure **never crashes** the primary operation (try/catch +
  logger)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Other Modules                        │
│  booking.service  │  order.service  │  forum.service   │
│  plantTracking    │  certification  │  vendor.service  │
└──────────────────────────┬──────────────────────────────┘
                           │  calls
                           ▼
              ┌────────────────────────┐
              │   createNotification() │  ← single entry point
              │  notification.service  │
              └───────────┬────────────┘
                          │
              ┌───────────┴──────────────┐
              │                          │
              ▼                          ▼
     ┌─────────────────┐     ┌─────────────────────┐
     │  Prisma DB      │     │  Socket.IO           │
     │  notifications  │     │  toUser(userId,      │
     │  table          │     │  'notification:new') │
     └─────────────────┘     └─────────────────────┘
```

---

## Socket.IO Integration

### Server-side (already implemented in `src/config/socket.ts`)

```ts
socketEmit.toUser(userId, 'notification:new', notificationPayload);
// → emits to room: `user:{userId}`
```

### Client-side (frontend must do this on login)

```ts
// After login, join personal room
socket.emit('join:room', `user:${currentUser.id}`);

// Listen for incoming notifications
socket.on('notification:new', (notification) => {
  // Show toast
  // Increment unread badge
  // Append to notification list
});
```

---

## Notification Model

```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String           // recipient
  type      NotificationType // category enum
  title     String           // short headline (shown in badge/toast)
  message   String           // full description
  data      Json?            // structured context (IDs, etc.)
  actionUrl String?          // deep-link for the frontend to navigate
  isRead    Boolean          @default(false)
  readAt    DateTime?
  createdAt DateTime         @default(now())
}
```

### NotificationType Enum

| Value                  | Used for                                             |
| ---------------------- | ---------------------------------------------------- |
| `BOOKING_UPDATE`       | Any change in booking lifecycle                      |
| `PLANT_UPDATE`         | Plant stage changes and growth updates               |
| `ORDER_UPDATE`         | Order status transitions                             |
| `PAYMENT_UPDATE`       | Payment confirmed or refunded                        |
| `CERTIFICATION_UPDATE` | Admin approves or rejects a certification            |
| `FORUM_ACTIVITY`       | Comments or reactions on your post                   |
| `SYSTEM`               | Account suspension, vendor approval, platform alerts |

---

## Complete Trigger Map

### 🗓️ Booking Module (`booking.service.ts`)

| Trigger                          | Recipient   | Type             | Title                              |
| -------------------------------- | ----------- | ---------------- | ---------------------------------- |
| Customer creates a booking       | **Vendor**  | `BOOKING_UPDATE` | "New Booking Request"              |
| Vendor sets status → `APPROVED`  | Customer    | `BOOKING_UPDATE` | "Booking Approved 🎉"              |
| Vendor sets status → `REJECTED`  | Customer    | `BOOKING_UPDATE` | "Booking Rejected"                 |
| Vendor sets status → `ACTIVE`    | Customer    | `BOOKING_UPDATE` | "Booking Now Active"               |
| Vendor sets status → `COMPLETED` | Customer    | `BOOKING_UPDATE` | "Booking Completed"                |
| Either party cancels             | Other party | `BOOKING_UPDATE` | "Booking Cancelled"                |
| Vendor adds extra cost           | Customer    | `BOOKING_UPDATE` | "Extra Cost Added to Your Booking" |

**Where to add the call:** After the primary `prisma.booking.create/update`
succeeds.

```ts
// Example — customer creates booking:
await createNotification({
  userId: vendorUserId, // from vendor.userId
  type: NotificationType.BOOKING_UPDATE,
  title: 'New Booking Request',
  message: `A customer requested to book "${gardenSpace.name}".`,
  actionUrl: `/vendor/bookings/${booking.id}`,
  data: { bookingId: booking.id },
});
```

---

### 🌱 Plant Tracking Module (`plantTracking.service.ts`)

| Trigger                                | Recipient | Type           | Title                               |
| -------------------------------------- | --------- | -------------- | ----------------------------------- |
| Vendor adds any plant update           | Customer  | `PLANT_UPDATE` | "New Plant Update 🌱"               |
| Plant stage changes to `HARVEST_READY` | Customer  | `PLANT_UPDATE` | "Your Crop is Ready to Harvest! 🌾" |

**Note:** The `HARVEST_READY` notification is a special case — fire it in
addition to the regular update notification when
`update.stage === 'HARVEST_READY'`. This is the most important lifecycle moment
for a customer.

```ts
// After plantUpdate is created:
await createNotification({
  userId: booking.customerId,
  type: NotificationType.PLANT_UPDATE,
  title: 'New Plant Update 🌱',
  message: `"${plantTracking.cropName}" updated to stage: ${update.stage}.`,
  actionUrl: `/plants/${plantTracking.id}`,
  data: { plantTrackingId: plantTracking.id, stage: update.stage },
});

// Special HARVEST_READY case:
if (update.stage === 'HARVEST_READY') {
  await createNotification({
    userId: booking.customerId,
    type: NotificationType.PLANT_UPDATE,
    title: '🌾 Your Crop is Ready to Harvest!',
    message: `"${plantTracking.cropName}" is ready. Contact your vendor to arrange collection.`,
    actionUrl: `/plants/${plantTracking.id}`,
    data: { plantTrackingId: plantTracking.id, stage: 'HARVEST_READY' },
  });
}
```

---

### 📦 Order Module (`order.service.ts`)

| Trigger                 | Recipient                | Type             | Title                          |
| ----------------------- | ------------------------ | ---------------- | ------------------------------ |
| Customer places order   | Customer                 | `ORDER_UPDATE`   | "Order Placed Successfully 🛒" |
| Customer places order   | **Each Vendor** in items | `ORDER_UPDATE`   | "New Order Received 📦"        |
| Status → `CONFIRMED`    | Customer                 | `ORDER_UPDATE`   | "Order Confirmed ✅"           |
| Status → `PREPARING`    | Customer                 | `ORDER_UPDATE`   | "Order Being Prepared"         |
| Status → `SHIPPED`      | Customer                 | `ORDER_UPDATE`   | "Order Shipped 🚚"             |
| Status → `DELIVERED`    | Customer                 | `ORDER_UPDATE`   | "Order Delivered 🎉"           |
| Status → `CANCELLED`    | Customer                 | `ORDER_UPDATE`   | "Order Cancelled"              |
| Status → `REFUNDED`     | Customer                 | `ORDER_UPDATE`   | "Order Refunded"               |
| Payment status → `PAID` | Customer                 | `PAYMENT_UPDATE` | "Payment Confirmed 💳"         |

**Note on multi-vendor orders:** When an order contains items from multiple
vendors, collect the unique `vendorId` values from `orderItems`, resolve each to
a `userId`, and fire one notification per vendor.

```ts
// Resolve vendor userIds from order items:
const vendorUserIds = await prisma.vendor.findMany({
  where: { id: { in: uniqueVendorIds } },
  select: { userId: true },
});
for (const { userId } of vendorUserIds) {
  await createNotification({ userId, type: NotificationType.ORDER_UPDATE, ... });
}
```

---

### 📜 Certification Module (`certification.service.ts`)

| Trigger                      | Recipient     | Type                   | Title                       |
| ---------------------------- | ------------- | ---------------------- | --------------------------- |
| Admin approves certification | Vendor's user | `CERTIFICATION_UPDATE` | "Certification Approved ✅" |
| Admin rejects certification  | Vendor's user | `CERTIFICATION_UPDATE` | "Certification Rejected"    |

**Where to add:** Inside `reviewCertification()`, after the
`prisma.certification.update` succeeds. Resolve `vendor.userId` from
`cert.vendorId` first.

```ts
const vendor = await prisma.vendor.findUnique({
  where: { id: cert.vendorId },
  select: { userId: true },
});
if (vendor) {
  await createNotification({
    userId: vendor.userId,
    type: NotificationType.CERTIFICATION_UPDATE,
    title: input.status === 'APPROVED' ? 'Certification Approved ✅' : 'Certification Rejected',
    message: ...,
    data: { certificationId: cert.id, status: input.status },
  });
}
```

---

### 💬 Forum Module (`forum.service.ts`)

| Trigger                                      | Recipient                 | Type             | Title                             |
| -------------------------------------------- | ------------------------- | ---------------- | --------------------------------- |
| Someone comments on a post                   | Post author (if not self) | `FORUM_ACTIVITY` | "New Comment on Your Post 💬"     |
| Someone reacts to a post (new reaction only) | Post author (if not self) | `FORUM_ACTIVITY` | "Someone Reacted to Your Post ❤️" |

**Self-interaction guard:** Always check `post.authorId !== actorId` before
firing. Do not notify for self-comments or self-reactions.

**Reaction deduplication:** Only notify on the first reaction from a user.
Changing or removing a reaction should not trigger new notifications.

---

### 🏪 Vendor Module (`vendor.service.ts`)

| Trigger                          | Recipient     | Type     | Title                         |
| -------------------------------- | ------------- | -------- | ----------------------------- |
| Admin approves vendor profile    | Vendor's user | `SYSTEM` | "Vendor Profile Approved 🎉"  |
| Admin rejects vendor application | Vendor's user | `SYSTEM` | "Vendor Application Rejected" |

---

### 👤 Admin / User Module

| Trigger               | Recipient | Type     | Title               |
| --------------------- | --------- | -------- | ------------------- |
| Admin suspends a user | That user | `SYSTEM` | "Account Suspended" |

---

## HTTP API Endpoints

All endpoints require authentication (`Authorization: Bearer <access_token>`).

| Method   | Path                                 | Description                                   |
| -------- | ------------------------------------ | --------------------------------------------- |
| `GET`    | `/api/v1/notifications`              | List my notifications (paginated, filterable) |
| `GET`    | `/api/v1/notifications/unread-count` | Unread badge count                            |
| `PATCH`  | `/api/v1/notifications/read-all`     | Mark all as read                              |
| `PATCH`  | `/api/v1/notifications/:id/read`     | Mark one as read                              |
| `DELETE` | `/api/v1/notifications/:id`          | Delete one notification                       |
| `DELETE` | `/api/v1/notifications/clear-all`    | Delete all notifications                      |

### Query Parameters for `GET /notifications`

| Param    | Type    | Description                              |
| -------- | ------- | ---------------------------------------- |
| `page`   | integer | Page number (default: 1)                 |
| `limit`  | integer | Items per page (default: 20, max: 100)   |
| `type`   | string  | Filter by `NotificationType`             |
| `isRead` | boolean | Filter by read status (`true` / `false`) |

### Response Shape

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications fetched successfully",
  "data": [
    {
      "id": "clxyz123",
      "type": "BOOKING_UPDATE",
      "title": "Booking Approved 🎉",
      "message": "Your garden space booking has been approved.",
      "data": { "bookingId": "clabc456" },
      "actionUrl": "/bookings/clabc456",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-04-18T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Real-time Event Shape (`notification:new`)

```json
{
  "id": "clxyz123",
  "type": "BOOKING_UPDATE",
  "title": "Booking Approved 🎉",
  "message": "Your garden space booking has been approved.",
  "data": { "bookingId": "clabc456" },
  "actionUrl": "/bookings/clabc456",
  "isRead": false,
  "createdAt": "2026-04-18T10:00:00.000Z"
}
```

---

## Integration Checklist

When integrating `createNotification()` into an existing service:

- [ ] Import `createNotification` from
      `@/modules/notifications/notification.service`
- [ ] Import `NotificationType` from `@prisma/client`
- [ ] Call `createNotification()` **after** the primary DB write, not before
- [ ] Use `await` — the function has internal try/catch so it won't throw
- [ ] Provide a meaningful `actionUrl` so the frontend can deep-link
- [ ] Include relevant IDs in `data` so the frontend can refresh the right data
- [ ] Add self-interaction guards in forum/reaction contexts
- [ ] For multi-vendor scenarios, loop and send once per vendor

---

## app.ts Registration

```ts
import notificationRoutes from '@/modules/notifications/notification.routes';

app.use(`/api/${env.API_VERSION}/notifications`, notificationRoutes);
```
