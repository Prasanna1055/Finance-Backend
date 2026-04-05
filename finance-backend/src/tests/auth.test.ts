
import request from "supertest";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const testDb = new Database(":memory:");
testDb.pragma("foreign_keys = ON");
testDb.exec(`
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('admin','analyst','viewer')),
    status        TEXT    NOT NULL DEFAULT 'active',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE financial_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    amount     INTEGER NOT NULL,
    type       TEXT    NOT NULL,
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

beforeAll(() => {
  const hash = bcrypt.hashSync("Admin@123", 1);
  testDb
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
    .run("Test Admin", "admin@test.com", hash, "admin");
});


describe("POST /auth/login", () => {
  it("returns token on valid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.com", password: "Admin@123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe("admin");
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.com", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing password field", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.com" });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toBeDefined();
  });

  it("returns 400 on invalid email format", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "not-an-email", password: "Admin@123" });
    expect(res.status).toBe(400);
  });

  it("returns 401 for inactive user", async () => {
    const hash = bcrypt.hashSync("Pass@123", 1);
    testDb
      .prepare("INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)")
      .run("Inactive", "inactive@test.com", hash, "viewer", "inactive");

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "inactive@test.com", password: "Pass@123" });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns user payload for valid token", async () => {
    const token = makeToken(1, "admin@test.com", "admin");
    const res   = await request(app).get("/auth/me").set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("admin");
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed Bearer token", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set({ Authorization: "Bearer bad.token.value" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header has no Bearer prefix", async () => {
    const token = makeToken(1, "admin@test.com", "admin");
    const res   = await request(app)
      .get("/auth/me")
      .set({ Authorization: token });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/permissions", () => {
  it("returns permission map without authentication", async () => {
    const res = await request(app).get("/auth/permissions");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("admin");
    expect(res.body.data).toHaveProperty("analyst");
    expect(res.body.data).toHaveProperty("viewer");
  });
});
