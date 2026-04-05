import Database, { Database as DatabaseType } from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../middleware/auth";
import { AuthPayload, Role } from "../types";

export function createTestDb(): DatabaseType {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('admin','analyst','viewer')),
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS financial_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount      INTEGER NOT NULL CHECK(amount > 0),
      type        TEXT NOT NULL CHECK(type IN ('income','expense')),
      category    TEXT NOT NULL,
      date        TEXT NOT NULL,
      notes       TEXT,
      deleted_at  TEXT DEFAULT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

// Generates a signed JWT for a user — bypasses real auth for testing 
export function makeToken(userId: number, email: string, role: Role): string {
  const payload: AuthPayload = { userId, email, role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

// Returns a valid Authorization header string 
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

// Hashes a password for seeding test users 
export function hash(password: string): string {
  return bcrypt.hashSync(password, 1); // cost=1 for fast tests
}
