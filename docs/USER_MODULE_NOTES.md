# User Module — Integration Notes

## 1. Mount the route in `src/app.ts`

Add the import and `app.use()` call (lines already stubbed with a comment):

```ts
// add this import alongside authRoutes
import userRoutes from '@/modules/users/user.routes';

// add this line in the API Routes section
app.use(`/api/${env.API_VERSION}/users`, userRoutes);
```

## 2. File structure created

```
src/modules/users/
├── user.types.ts        ← Zod schemas + TS types
├── user.service.ts      ← Business logic / Prisma queries
├── user.controller.ts   ← Thin HTTP layer
└── user.routes.ts       ← Router with middleware guards
```

## 3. Endpoints


| Method | Path                      | Auth       | Description                                 |
| ------ | ------------------------- | ---------- | ------------------------------------------- |
| GET    | /users/me                 | Any role   | Get own full profile                        |
| PATCH  | /users/me                 | Any role   | Update name / phone                         |
| PATCH  | /users/me/avatar          | Any role   | Set avatarUrl (Cloudinary URL)              |
| PATCH  | /users/me/change-password | Any role   | Change password (revokes RT)                |
| GET    | /users/:id                | Any role   | Full profile (self/admin), public otherwise |
| GET    | /users                    | ADMIN only | Paginated list with filters                 |
| PATCH  | /users/:id/status         | ADMIN only | Suspend or reactivate a user                |


## 4. Query params for GET /users


| Param  | Type                            | Description          |
| ------ | ------------------------------- | -------------------- |
| page   | number (default 1)              | Pagination           |
| limit  | number (default 10, max 100)    | Page size            |
| role   | ADMIN | VENDOR | CUSTOMER       | Filter by role       |
| status | ACTIVE | SUSPENDED | UNVERIFIED | Filter by status     |
| search | string                          | Search name or email |


## 5. Security behaviours

- `changePassword` — verifies old password, then revokes all refresh tokens for
that user (forces re-login on other devices).
- `updateUserStatus(SUSPENDED)` — additionally revokes all refresh tokens for
the target user.
- Admins cannot change their own status or another admin's status.
- `GET /users/:id` returns the full `IUserProfile` when the requester is ADMIN
or the owner; otherwise returns the limited `IPublicUserProfile` (no email,
phone, status, etc.).

