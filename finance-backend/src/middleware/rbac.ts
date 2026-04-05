import { Request, Response, NextFunction } from "express";
import { Role } from "../types";
import { forbidden, unauthorized } from "../utils/response";

const ROLE_RANK: Record<Role, number> = {
  viewer:  1,
  analyst: 2,
  admin:   3,
};

export function requireRole(minimum: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (ROLE_RANK[req.user.role] < ROLE_RANK[minimum]) {
      forbidden(res, `Requires role '${minimum}' or higher`);
      return;
    }

    next();
  };
}

/**
 * requireExactRoles
 * Returns middleware that allows only the listed roles (no hierarchy).
 * Useful when you want to restrict a route to specific roles.
 */
export function requireExactRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    if (!roles.includes(req.user.role)) {
      forbidden(res, `This action is restricted to: ${roles.join(", ")}`);
      return;
    }

    next();
  };
}

/**
 * Permission map – single source of truth for what each role can do.
 * Referenced in documentation and can be queried via /auth/permissions.
 */
export const PERMISSIONS: Record<Role, string[]> = {
  viewer: [
    "records:read",
    "dashboard:read",
  ],
  analyst: [
    "records:read",
    "records:create",
    "dashboard:read",
  ],
  admin: [
    "records:read",
    "records:create",
    "records:update",
    "records:delete",
    "users:read",
    "users:create",
    "users:update",
    "dashboard:read",
  ],
};
