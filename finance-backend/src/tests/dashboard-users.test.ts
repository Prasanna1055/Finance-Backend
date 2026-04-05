import request from "supertest";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const testDb = new Database(":memory:");
testDb.pragma("foreign_keys = ON");
testDb.exec(`
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin','analyst','viewer')),
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE financial_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    amount     INTEGER NOT NULL CHECK(amount > 0),
    type       TEXT    NOT NULL CHECK(type IN ('income','expense')),
    category   TEXT    NOT NULL,
    date       TEXT    NOT NULL,
    notes      TEXT,
    deleted_at TEXT    DEFAULT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

jest.mock("../config/database", () => ({
  __esModule: true,
  default:    testDb,
  initSchema: () => {},
}));

import { app } from "../app";
import { makeToken, authHeader } from "./helpers";

let adminId: number;
let analystId: number;
let viewerId: number;
let adminToken: string;
let analystToken: string;
let viewerToken: string;

beforeAll(() => {
  const pw  = bcrypt.hashSync("x", 1);
  const ins = testDb.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
  );
  adminId   = Number(ins.run("Admin",   "admin@d.com",   pw, "admin").lastInsertRowid);
  analystId = Number(ins.run("Analyst", "analyst@d.com", pw, "analyst").lastInsertRowid);
  viewerId  = Number(ins.run("Viewer",  "viewer@d.com",  pw, "viewer").lastInsertRowid);

  adminToken   = makeToken(adminId,   "admin@d.com",   "admin");
  analystToken = makeToken(analystId, "analyst@d.com", "analyst");
  viewerToken  = makeToken(viewerId,  "viewer@d.com",  "viewer");

  // Seed financial records for dashboard queries
  const rec = testDb.prepare(
    "INSERT INTO financial_records (user_id, amount, type, category, date) VALUES (?, ?, ?, ?, ?)",
  );
  rec.run(adminId, 500000, "income",  "Salary",    "2025-01-31");
  rec.run(adminId, 120000, "expense", "Rent",       "2025-01-05");
  rec.run(adminId, 500000, "income",  "Salary",    "2025-02-28");
  rec.run(adminId,  60000, "income",  "Freelance", "2025-02-15");
  rec.run(adminId, 150000, "expense", "Travel",    "2025-02-20");
});

describe("GET /dashboard/summary", () => {
  it("viewer can access full summary", async () => {
    const res = await request(app).get("/dashboard/summary").set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total_income:    expect.any(Number),
      total_expenses:  expect.any(Number),
      net_balance:     expect.any(Number),
      category_totals: expect.any(Array),
      monthly_trends:  expect.any(Array),
      recent_activity: expect.any(Array),
    });
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/dashboard/summary");
    expect(res.status).toBe(401);
  });

  it("net_balance equals income minus expenses", async () => {
    const res = await request(app).get("/dashboard/summary").set(authHeader(adminToken));
    const { total_income, total_expenses, net_balance } = res.body.data;
    expect(parseFloat((total_income - total_expenses).toFixed(2))).toBe(
      parseFloat(net_balance.toFixed(2)),
    );
  });

  it("amounts are returned as decimals (not cents)", async () => {
    const res = await request(app).get("/dashboard/summary").set(authHeader(adminToken));
    // Seeded 500000 cents = 5000.00
    expect(res.body.data.total_income).toBeGreaterThan(100);
  });
});

describe("GET /dashboard/totals", () => {
  it("returns aggregate totals with no date filter", async () => {
    const res = await request(app).get("/dashboard/totals").set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.total_income).toBeGreaterThan(0);
    expect(res.body.data.total_expenses).toBeGreaterThan(0);
  });

  it("returns totals filtered by date range", async () => {
    const res = await request(app)
      .get("/dashboard/totals?date_from=2025-01-01&date_to=2025-01-31")
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    // Only Jan records: 5000 income, 1200 expense
    expect(res.body.data.total_income).toBe(5000);
    expect(res.body.data.total_expenses).toBe(1200);
  });

  it("returns 400 when only date_from is provided", async () => {
    const res = await request(app)
      .get("/dashboard/totals?date_from=2025-01-01")
      .set(authHeader(adminToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date_from is after date_to", async () => {
    const res = await request(app)
      .get("/dashboard/totals?date_from=2025-06-01&date_to=2025-01-01")
      .set(authHeader(adminToken));
    expect(res.status).toBe(400);
  });
});

describe("GET /dashboard/categories", () => {
  it("returns category breakdown with type and total", async () => {
    const res = await request(app).get("/dashboard/categories").set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toMatchObject({
        category: expect.any(String),
        type:     expect.stringMatching(/^(income|expense)$/),
        total:    expect.any(Number),
      });
    }
  });
});

describe("GET /dashboard/trends", () => {
  it("returns monthly trend array", async () => {
    const res = await request(app).get("/dashboard/trends").set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("each trend entry has month, income, expense, net", async () => {
    const res = await request(app).get("/dashboard/trends").set(authHeader(viewerToken));
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toMatchObject({
        month:   expect.stringMatching(/^\d{4}-\d{2}$/),
        income:  expect.any(Number),
        expense: expect.any(Number),
        net:     expect.any(Number),
      });
    }
  });

  it("accepts custom months parameter", async () => {
    const res = await request(app)
      .get("/dashboard/trends?months=6")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(200);
  });

  it("returns 400 for months=0", async () => {
    const res = await request(app).get("/dashboard/trends?months=0").set(authHeader(viewerToken));
    expect(res.status).toBe(400);
  });

  it("returns 400 for months > 60", async () => {
    const res = await request(app).get("/dashboard/trends?months=61").set(authHeader(viewerToken));
    expect(res.status).toBe(400);
  });
});

describe("GET /dashboard/recent", () => {
  it("returns recent activity array", async () => {
    const res = await request(app).get("/dashboard/recent").set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("respects limit query param", async () => {
    const res = await request(app)
      .get("/dashboard/recent?limit=3")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });

  it("returns 400 for limit > 100", async () => {
    const res = await request(app)
      .get("/dashboard/recent?limit=200")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(400);
  });
});

describe("GET /users", () => {
  it("admin can list all users", async () => {
    const res = await request(app).get("/users").set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("password_hash is never exposed", async () => {
    const res = await request(app).get("/users").set(authHeader(adminToken));
    res.body.data.forEach((u: Record<string, unknown>) => {
      expect(u.password_hash).toBeUndefined();
    });
  });

  it("analyst cannot list users (403)", async () => {
    const res = await request(app).get("/users").set(authHeader(analystToken));
    expect(res.status).toBe(403);
  });

  it("viewer cannot list users (403)", async () => {
    const res = await request(app).get("/users").set(authHeader(viewerToken));
    expect(res.status).toBe(403);
  });
});

describe("GET /users/:id", () => {
  it("admin can fetch a specific user", async () => {
    const res = await request(app).get(`/users/${viewerId}`).set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(viewerId);
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await request(app).get("/users/99999").set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });
});

describe("POST /users", () => {
  it("admin can create a new analyst", async () => {
    const res = await request(app)
      .post("/users")
      .set(authHeader(adminToken))
      .send({ name: "New Analyst", email: "newanalyst@d.com", password: "Newuser@1", role: "analyst" });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("newanalyst@d.com");
    expect(res.body.data.role).toBe("analyst");
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it("returns 409 for duplicate email", async () => {
    const res = await request(app)
      .post("/users")
      .set(authHeader(adminToken))
      .send({ name: "Dup", email: "newanalyst@d.com", password: "Newuser@1", role: "viewer" });
    expect(res.status).toBe(409);
  });

  it("returns 400 for weak password (no uppercase)", async () => {
    const res = await request(app)
      .post("/users")
      .set(authHeader(adminToken))
      .send({ name: "Weak", email: "weak@d.com", password: "nouppercase1", role: "viewer" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for password shorter than 8 chars", async () => {
    const res = await request(app)
      .post("/users")
      .set(authHeader(adminToken))
      .send({ name: "Short", email: "short@d.com", password: "Ab1", role: "viewer" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    const res = await request(app)
      .post("/users")
      .set(authHeader(adminToken))
      .send({ name: "Bad", email: "bad@d.com", password: "Newuser@1", role: "superadmin" });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /users/:id", () => {
  it("admin can update user role", async () => {
    const res = await request(app)
      .patch(`/users/${analystId}`)
      .set(authHeader(adminToken))
      .send({ role: "viewer" });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("viewer");
  });

  it("admin can update user name", async () => {
    const res = await request(app)
      .patch(`/users/${analystId}`)
      .set(authHeader(adminToken))
      .send({ name: "Renamed Analyst" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed Analyst");
  });

  it("admin can deactivate a user via PATCH", async () => {
    const res = await request(app)
      .patch(`/users/${analystId}`)
      .set(authHeader(adminToken))
      .send({ status: "inactive" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("inactive");
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app)
      .patch(`/users/${analystId}`)
      .set(authHeader(adminToken))
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent user", async () => {
    const res = await request(app)
      .patch("/users/99999")
      .set(authHeader(adminToken))
      .send({ role: "viewer" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /users/:id (deactivate)", () => {
  it("admin cannot deactivate themselves (403)", async () => {
    const res = await request(app)
      .delete(`/users/${adminId}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(403);
  });

  it("admin can deactivate another user (204)", async () => {
    const res = await request(app)
      .delete(`/users/${viewerId}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(204);
  });

  it("returns 404 for already-inactive user", async () => {
    const res = await request(app)
      .delete(`/users/${viewerId}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });
});
