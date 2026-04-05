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
  const pw = bcrypt.hashSync("x", 1);
  const ins = testDb.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
  );
  adminId   = Number(ins.run("Admin",   "admin@r.com",   pw, "admin").lastInsertRowid);
  analystId = Number(ins.run("Analyst", "analyst@r.com", pw, "analyst").lastInsertRowid);
  viewerId  = Number(ins.run("Viewer",  "viewer@r.com",  pw, "viewer").lastInsertRowid);

  adminToken   = makeToken(adminId,   "admin@r.com",   "admin");
  analystToken = makeToken(analystId, "analyst@r.com", "analyst");
  viewerToken  = makeToken(viewerId,  "viewer@r.com",  "viewer");
});

const basePayload = {
  amount:   1500.00,
  type:     "income",
  category: "Salary",
  date:     "2025-01-15",
  notes:    "January salary",
};


describe("POST /records", () => {
  it("analyst can create a record", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send(basePayload);
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(1500);
    expect(res.body.data.category).toBe("Salary");
  });

  it("admin can create a record", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(adminToken))
      .send({ ...basePayload, amount: 2000 });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(2000);
  });

  it("viewer cannot create a record (403)", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(viewerToken))
      .send(basePayload);
    expect(res.status).toBe(403);
  });

  it("returns 400 for negative amount", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ ...basePayload, amount: -500 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero amount", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ ...basePayload, amount: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid date format (DD-MM-YYYY)", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ ...basePayload, date: "15-01-2025" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ ...basePayload, type: "transfer" });
    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).post("/records").send(basePayload);
    expect(res.status).toBe(401);
  });

  it("stored amount is accessible as decimal (cents conversion)", async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ ...basePayload, amount: 99.99 });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(99.99);
  });
});

describe("GET /records", () => {
  it("viewer can list records with pagination", async () => {
    const res = await request(app).get("/records").set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toBeDefined();
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.pagination).toMatchObject({
      page:       1,
      page_size:  20,
    });
  });

  it("supports filtering by type=income", async () => {
    const res = await request(app)
      .get("/records?type=income")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    res.body.data.data.forEach((r: { type: string }) => {
      expect(r.type).toBe("income");
    });
  });

  it("supports date_from / date_to filters", async () => {
    const res = await request(app)
      .get("/records?date_from=2025-01-01&date_to=2025-01-31")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    res.body.data.data.forEach((r: { date: string }) => {
      expect(r.date >= "2025-01-01").toBe(true);
      expect(r.date <= "2025-01-31").toBe(true);
    });
  });

  it("supports pagination via page and page_size", async () => {
    const res = await request(app)
      .get("/records?page=1&page_size=2")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeLessThanOrEqual(2);
    expect(res.body.data.pagination.page_size).toBe(2);
  });

  it("returns 400 for invalid type filter", async () => {
    const res = await request(app)
      .get("/records?type=bogus")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(400);
  });
});


describe("GET /records/:id", () => {
  let recordId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ amount: 300, type: "expense", category: "Utilities", date: "2025-03-10" });
    recordId = res.body.data.id;
  });

  it("viewer can fetch a single record", async () => {
    const res = await request(app)
      .get(`/records/${recordId}`)
      .set(authHeader(viewerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(recordId);
  });

  it("returns 404 for nonexistent id", async () => {
    const res = await request(app)
      .get("/records/999999")
      .set(authHeader(viewerToken));
    expect(res.status).toBe(404);
  });
});


describe("PATCH /records/:id", () => {
  let recordId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ amount: 500, type: "expense", category: "Rent", date: "2025-02-01" });
    recordId = res.body.data.id;
  });

  it("admin can update amount and notes", async () => {
    const res = await request(app)
      .patch(`/records/${recordId}`)
      .set(authHeader(adminToken))
      .send({ amount: 600, notes: "Updated rent" });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(600);
    expect(res.body.data.notes).toBe("Updated rent");
  });

  it("analyst cannot update a record (403)", async () => {
    const res = await request(app)
      .patch(`/records/${recordId}`)
      .set(authHeader(analystToken))
      .send({ amount: 700 });
    expect(res.status).toBe(403);
  });

  it("viewer cannot update a record (403)", async () => {
    const res = await request(app)
      .patch(`/records/${recordId}`)
      .set(authHeader(viewerToken))
      .send({ amount: 700 });
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent record", async () => {
    const res = await request(app)
      .patch("/records/99999")
      .set(authHeader(adminToken))
      .send({ amount: 100 });
    expect(res.status).toBe(404);
  });

  it("returns 400 when body is empty object", async () => {
    const res = await request(app)
      .patch(`/records/${recordId}`)
      .set(authHeader(adminToken))
      .send({});
    expect(res.status).toBe(400);
  });
});


describe("DELETE /records/:id (soft delete)", () => {
  let recordId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ amount: 999, type: "income", category: "Bonus", date: "2025-03-01" });
    recordId = res.body.data.id;
  });

  it("admin can soft-delete a record (204)", async () => {
    const res = await request(app)
      .delete(`/records/${recordId}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(204);
  });

  it("deleted record is invisible in GET /records/:id", async () => {
    const res = await request(app)
      .get(`/records/${recordId}`)
      .set(authHeader(viewerToken));
    expect(res.status).toBe(404);
  });

  it("deleted record is absent from GET /records list", async () => {
    const res = await request(app).get("/records").set(authHeader(viewerToken));
    const ids = res.body.data.data.map((r: { id: number }) => r.id);
    expect(ids).not.toContain(recordId);
  });

  it("analyst cannot delete (403)", async () => {
    const newRes = await request(app)
      .post("/records")
      .set(authHeader(analystToken))
      .send({ amount: 100, type: "expense", category: "Test", date: "2025-04-01" });
    const newId = newRes.body.data.id;

    const res = await request(app)
      .delete(`/records/${newId}`)
      .set(authHeader(analystToken));
    expect(res.status).toBe(403);
  });

  it("returns 404 for already-deleted record", async () => {
    const res = await request(app)
      .delete(`/records/${recordId}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(404);
  });
});
