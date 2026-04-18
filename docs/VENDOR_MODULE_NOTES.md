# Vendor Module — app.ts Integration

## 1. Add import to src/app.ts

Add this import alongside the existing route imports:

```ts
import vendorRoutes from '@/modules/vendor/vendor.routes';
```

## 2. Mount the route in src/app.ts

Add this line after the existing user routes mount:

```ts
app.use(`/api/${env.API_VERSION}/vendors`, vendorRoutes);
```

## 3. Update messages.constants.ts

The MESSAGES.VENDOR object is already present in your constants file — no
changes needed.

## 4. Route ordering note in vendor.routes.ts

Express matches routes top-to-bottom, so `/me` MUST be declared BEFORE `/:id` to
prevent Express treating "me" as an ID parameter.

The routes file already handles this correctly.

---

## Complete Vendor API Surface

| Method | Route               | Role     | Description                            |
| ------ | ------------------- | -------- | -------------------------------------- |
| POST   | /vendors            | VENDOR   | Create vendor profile (→ PENDING)      |
| GET    | /vendors            | ANY auth | List approved vendors (admin sees all) |
| GET    | /vendors/me         | VENDOR   | Get own vendor profile                 |
| PATCH  | /vendors/me         | VENDOR   | Update own vendor profile              |
| PATCH  | /vendors/me/logo    | VENDOR   | Update logo URL                        |
| PATCH  | /vendors/me/cover   | VENDOR   | Update cover image URL                 |
| GET    | /vendors/:id        | ANY auth | Get vendor by ID (public view)         |
| PATCH  | /vendors/:id/status | ADMIN    | Approve / reject / suspend vendor      |
