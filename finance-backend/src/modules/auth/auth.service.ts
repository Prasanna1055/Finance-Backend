import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../../config/database";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../../middleware/auth";
import { AuthPayload, User } from "../../types";

export interface LoginResult {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export function login(email: string, password: string): LoginResult {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ? AND status = 'active'")
    .get(email) as User | undefined;

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as unknown as number });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}
