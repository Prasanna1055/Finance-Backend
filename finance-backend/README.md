# Finance Backend

A RESTful backend for a finance dashboard system with role-based access control,
financial record management, and aggregated analytics. Built with **Node.js +
TypeScript**, **Express**, **SQLite** (via better-sqlite3), **Zod** validation,
and **JWT** authentication.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Design Decisions](#design-decisions)
4. [Assumptions](#assumptions)
5. [Authentication](#authentication)
6. [Roles & Permissions](#roles--permissions)
7. [API Reference](#api-reference)
   - [Auth](#auth-endpoints)
   - [Records](#record-endpoints)
   - [Dashboard](#dashboard-endpoints)
   - [Users](#user-endpoints)
8. [Validation & Error Handling](#validation--error-handling)
9. [Running Tests](#running-tests)
10. [Environment Variables](#environment-variables)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed the database with sample users and records
npm run seed

# 3. Start the development server
npm run dev
# → Server running at http://localhost:3000
```

**Test credentials** (created by seed):

| Role    | Email                  | Password      |
|---------|------------------------|---------------|
| admin   | admin@finance.dev      | Admin@123     |
| analyst | analyst@finance.dev    | Analyst@123   |
| viewer  | viewer@finance.dev     | Viewer@123    |

---

## Project Structure

```
src/
├── config/
│   ├── database.ts          # SQLite connection + WAL mode + schema init
│   └── seed.ts              # Bootstrap script (users + sample records)
├── middleware/
│   ├── auth.ts              # JWT Bearer token verification
│   ├── rbac.ts              # requireRole() guard + permission map
│   └── errorHandler.ts      # Global error handler + asyncHandler wrapper
├── modules/
│   ├── auth/                # Login, /me, /permissions
│   │   ├── auth.schema.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── auth.routes.ts
│   ├── users/               # User CRUD (admin only)
│   │   ├── user.schema.ts
│   │   ├── user.service.ts
│   │   ├── user.controller.ts
│   │   └── user.routes.ts
│   ├── records/             # Financial records with filtering + soft delete
│   │   ├── record.schema.ts
│   │   ├── record.service.ts
│   │   ├── record.controller.ts
│   │   └── record.routes.ts
│   └── dashboard/           # Analytics and summary endpoints
│       ├── dashboard.service.ts
│       ├── dashboard.controller.ts
│       └── dashboard.routes.ts
├── types/
│   └── index.ts             # All shared TypeScript interfaces
├── utils/
│   └── response.ts          # Typed response helpers + amount conversion
├── tests/
│   ├── helpers.ts           # In-memory DB setup + token factory
│   ├── auth.test.ts         # 12 auth tests
│   ├── records.test.ts      # 37 records tests
│   └── dashboard-users.test.ts  # 23 dashboard + user tests
└── app.ts                   # Express app setup + route registration
```

Each module is entirely self-contained: its schema, service, controller, and
routes live together. Nothing outside a module reaches directly into another
module's internals — they communicate only via their exported service functions.

---

## Design Decisions

### 1. Amounts stored as integer cents
All monetary amounts are stored in the database as **integer cents** (e.g.
`$19.99` → `1999`). This eliminates floating-point rounding errors during
aggregation. The conversion happens at a single boundary — `toCents()` on write
and `fromCents()` on read — in `utils/response.ts`.

### 2. Soft deletes
Financial records are never physically deleted. A `deleted_at` timestamp is set
instead. This preserves audit history and makes accidental deletions recoverable.
All queries filter `WHERE deleted_at IS NULL` by default.

### 3. Role hierarchy via a rank map
Rather than maintaining an explicit allow-list per endpoint, roles are given
numeric ranks (`viewer=1`, `analyst=2`, `admin=3`). The `requireRole(minimum)`
middleware checks `rank[user.role] >= rank[minimum]`. This means granting a
higher role automatically inherits all lower-role permissions, and adding a new
permission tier in the future requires changing one line.

### 4. Zod for schema validation
Zod schemas are co-located with their module (e.g. `record.schema.ts` alongside
`record.service.ts`). Zod's `.safeParse()` is used everywhere so errors are
returned as structured field-level details rather than thrown exceptions.

### 5. Single shared DB connection
`better-sqlite3` is synchronous and serialises writes internally. A single
module-level connection is exported and reused across all services — no
connection pooling overhead, no async database calls, and no risk of
write-write conflicts on a single-process server.

### 6. No ORM
Raw SQL is used throughout, with parameterised queries via `better-sqlite3`'s
prepared statements to prevent SQL injection. For a project of this scope, the
clarity and predictability of explicit SQL outweighs ORM convenience.

---

## Assumptions

- A **single-process** deployment is assumed (appropriate for the scope of this
  assignment). SQLite is not suitable for multi-process or distributed setups.
- **Users cannot change their own password** in this version (not in the spec).
- **Analysts can create records** but cannot modify or delete them — this models
  a data-entry role that feeds the dashboard without being able to alter history.
- Financial records belong to the user who created them (`user_id` is stored),
  but any authenticated user with sufficient role can read all records. A
  per-user scoping layer could be added without structural changes.
- Amounts are assumed to be in a single currency. Multi-currency support would
  require a `currency` field and conversion logic.
- `date` on a record represents the **business date** of the transaction
  (e.g. invoice date), not the system timestamp of creation.

---

## Authentication

The API uses **JWT Bearer tokens**. Include the token in every protected request:

```
Authorization: Bearer <token>
```

Tokens are signed with `JWT_SECRET` (default: `finance-dev-secret-change-in-prod`)
and expire after `8h` by default (configurable via `JWT_EXPIRES_IN`).

---

## Roles & Permissions

| Action                        | viewer | analyst | admin |
|-------------------------------|:------:|:-------:|:-----:|
| Read financial records        |   ✅   |   ✅    |  ✅   |
| Create financial records      |   ❌   |   ✅    |  ✅   |
| Update financial records      |   ❌   |   ❌    |  ✅   |
| Delete (soft) financial records |  ❌  |   ❌    |  ✅   |
| View dashboard / analytics    |   ✅   |   ✅    |  ✅   |
| List / view users             |   ❌   |   ❌    |  ✅   |
| Create users                  |   ❌   |   ❌    |  ✅   |
| Update users                  |   ❌   |   ❌    |  ✅   |
| Deactivate users              |   ❌   |   ❌    |  ✅   |

---

## API Reference

All responses follow a consistent envelope:

```jsonc
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [...] } }
```

---

### Auth Endpoints

#### `POST /auth/login`
Authenticate and receive a JWT.

**Body**
```json
{ "email": "admin@finance.dev", "password": "Admin@123" }
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": { "id": 1, "name": "Alice Admin", "email": "admin@finance.dev", "role": "admin" }
  }
}
```

**Errors:** `400` validation failed · `401` invalid credentials

---

#### `GET /auth/me` 
Returns the authenticated user's identity from the token payload.

**Response `200`**
```json
{ "success": true, "data": { "userId": 1, "email": "admin@finance.dev", "role": "admin" } }
```

---

#### `GET /auth/permissions`
Returns the full permission map for all roles (public, useful for frontend menus).

---

### Record Endpoints

All require authentication. Write operations require `analyst` or `admin`.
Delete and update require `admin`.

#### `GET /records`  (viewer+)
List records with optional filters and pagination.

**Query Parameters**

| Param       | Type                  | Description                     |
|-------------|-----------------------|---------------------------------|
| `type`      | `income` \| `expense` | Filter by record type           |
| `category`  | string                | Filter by category (case-insensitive) |
| `date_from` | `YYYY-MM-DD`          | Start of date range             |
| `date_to`   | `YYYY-MM-DD`          | End of date range               |
| `search`    | string                | Full-text search on notes + category |
| `page`      | integer (default: 1)  | Page number                     |
| `page_size` | integer (default: 20, max: 100) | Results per page     |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1, "user_id": 1, "amount": 5000.00,
        "type": "income", "category": "Salary",
        "date": "2025-01-31", "notes": "Monthly salary",
        "created_at": "2025-01-31T00:00:00", "updated_at": "2025-01-31T00:00:00"
      }
    ],
    "pagination": { "total": 20, "page": 1, "page_size": 20, "total_pages": 1 }
  }
}
```

---

#### `GET /records/:id`  (viewer+)
Fetch a single record by ID.

**Errors:** `404` not found

---

#### `POST /records`  (analyst+)
Create a new financial record.

**Body**
```json
{
  "amount":   1500.00,
  "type":     "income",
  "category": "Salary",
  "date":     "2025-06-01",
  "notes":    "June salary"
}
```

**Validation rules**
- `amount`: positive number (required)
- `type`: `"income"` or `"expense"` (required)
- `category`: non-empty string, max 100 chars (required)
- `date`: `YYYY-MM-DD` format (required)
- `notes`: string, max 500 chars (optional)

**Response `201`** — the created record

---

#### `PATCH /records/:id`  (admin only)
Partially update a record. All fields are optional, but at least one must be provided.

**Body** *(all fields optional)*
```json
{ "amount": 1600.00, "notes": "Updated" }
```

**Errors:** `400` empty body or validation · `404` not found · `403` insufficient role

---

#### `DELETE /records/:id`  (admin only)
Soft-delete a record (sets `deleted_at`). Returns `204 No Content`.
The record is excluded from all subsequent reads. Attempting to delete an
already-deleted record returns `404`.

---

### Dashboard Endpoints

All require authentication (`viewer` and above).

#### `GET /dashboard/summary`
Returns the complete dashboard payload in one request.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "total_income": 15600.00,
    "total_expenses": 5570.00,
    "net_balance": 10030.00,
    "category_totals": [
      { "category": "Salary", "type": "income", "total": 10000.00 },
      { "category": "Rent",   "type": "expense", "total": 2400.00 }
    ],
    "monthly_trends": [
      { "month": "2025-01", "income": 5800.00, "expense": 1650.00, "net": 4150.00 }
    ],
    "recent_activity": [ ... ]
  }
}
```

---

#### `GET /dashboard/totals`
Total income, expenses, and net balance.

**Query Parameters** *(both required together for range filtering)*

| Param       | Type         | Description        |
|-------------|--------------|--------------------|
| `date_from` | `YYYY-MM-DD` | Range start        |
| `date_to`   | `YYYY-MM-DD` | Range end          |

**Errors:** `400` if only one date is provided, or `date_from > date_to`

---

#### `GET /dashboard/categories`
Per-category totals grouped by type, sorted descending by total.

---

#### `GET /dashboard/trends`
Monthly income vs expense vs net, for the last N months.

**Query Parameters**

| Param    | Type              | Default | Description              |
|----------|-------------------|---------|--------------------------|
| `months` | integer (1–60)    | `12`    | How many months to look back |

---

#### `GET /dashboard/recent`
Most recent financial records.

**Query Parameters**

| Param   | Type             | Default | Description               |
|---------|------------------|---------|---------------------------|
| `limit` | integer (1–100)  | `10`    | Number of records to return |

---

### User Endpoints

All require authentication and the `admin` role.

#### `GET /users`
List all users. **Password hashes are never returned.**

#### `GET /users/:id`
Fetch a single user by ID.

#### `POST /users`
Create a new user.

**Body**
```json
{
  "name":     "Jane Doe",
  "email":    "jane@company.com",
  "password": "Secure@123",
  "role":     "analyst"
}
```

**Password rules:** minimum 8 characters, at least one uppercase letter,
at least one digit.

**Errors:** `400` validation · `409` email already in use

#### `PATCH /users/:id`
Update name, role, or status. All fields optional; at least one required.

```json
{ "role": "admin", "status": "inactive" }
```

**Note:** Only an `admin` can assign the `admin` role.

#### `DELETE /users/:id`
Deactivates a user (sets `status = 'inactive'`). Returns `204 No Content`.
An admin cannot deactivate their own account. Deactivating an already-inactive
user returns `404`.

---

## Validation & Error Handling

All input is validated with **Zod** before reaching service logic. Invalid
requests receive a structured `400` response with per-field details:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": [
      { "field": "amount", "message": "Number must be greater than 0" },
      { "field": "date",   "message": "Date must be in YYYY-MM-DD format" }
    ]
  }
}
```

**HTTP status codes used:**

| Code | Meaning                                        |
|------|------------------------------------------------|
| 200  | OK                                             |
| 201  | Created                                        |
| 204  | No Content (successful delete/deactivate)      |
| 400  | Bad Request — validation or logic error        |
| 401  | Unauthorized — missing or invalid token        |
| 403  | Forbidden — authenticated but insufficient role|
| 404  | Not Found                                      |
| 409  | Conflict — e.g. duplicate email                |
| 500  | Internal Server Error                          |

---

## Running Tests

```bash
npm test
```

Tests use **Jest** + **Supertest** with an isolated **in-memory SQLite database**
per test suite. The production database is never touched during testing.

```
Tests: 72 passed, 72 total
Test Suites: 3 passed, 3 total

  auth.test.ts            — 12 tests (login, /me, token validation)
  records.test.ts         — 37 tests (CRUD, RBAC, soft delete, filtering)
  dashboard-users.test.ts — 23 tests (analytics, user management)
```

---

## Environment Variables

| Variable        | Default                                  | Description               |
|-----------------|------------------------------------------|---------------------------|
| `PORT`          | `3000`                                   | HTTP port                 |
| `DB_PATH`       | `./finance.db`                           | SQLite file path          |
| `JWT_SECRET`    | `finance-dev-secret-change-in-prod`      | JWT signing secret        |
| `JWT_EXPIRES_IN`| `8h`                                     | Token expiry duration     |

Create a `.env` file in the project root to override these locally.

---

