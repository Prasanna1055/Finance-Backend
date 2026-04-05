import bcrypt from "bcryptjs";
import db from "../../config/database";
import { User, SafeUser } from "../../types";
import { CreateUserInput, UpdateUserInput } from "./user.schema";

const SALT_ROUNDS = 10;

function safeUser(user: User): SafeUser {
  const { password_hash, ...safe } = user;
  return safe;
}

export function getAllUsers(): SafeUser[] {
  const rows = db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all() as User[];
  return rows.map(safeUser);
}

export function getUserById(id: number): SafeUser | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  return row ? safeUser(row) : null;
}

export function getUserByEmail(email: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
}

export function createUser(input: CreateUserInput): SafeUser {
  const existing = getUserByEmail(input.email);
  if (existing) throw new Error("EMAIL_IN_USE");

  const hash = bcrypt.hashSync(input.password, SALT_ROUNDS);

  const result = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    )
    .run(input.name, input.email, hash, input.role);

  return getUserById(result.lastInsertRowid as number)!;
}

export function updateUser(id: number, input: UpdateUserInput): SafeUser | null {
  const user = getUserById(id);
  if (!user) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name   !== undefined) { fields.push("name = ?");   values.push(input.name);   }
  if (input.role   !== undefined) { fields.push("role = ?");   values.push(input.role);   }
  if (input.status !== undefined) { fields.push("status = ?"); values.push(input.status); }

  if (fields.length === 0) return user;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getUserById(id);
}

export function deactivateUser(id: number): boolean {
  const result = db
    .prepare("UPDATE users SET status = 'inactive', updated_at = datetime('now') WHERE id = ? AND status = 'active'")
    .run(id);
  return result.changes > 0;
}
