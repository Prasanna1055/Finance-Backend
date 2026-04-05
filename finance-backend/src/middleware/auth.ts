import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthPayload } from "../types";
import { unauthorized } from "../utils/response";

export const JWT_SECRET = process.env.JWT_SECRET ?? "finance-dev-secret-change-in-prod";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    unauthorized(res);
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    unauthorized(res, "Invalid or expired token");
  }
}
