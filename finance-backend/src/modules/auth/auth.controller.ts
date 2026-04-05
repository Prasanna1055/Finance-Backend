import { Request, Response } from "express";
import { LoginSchema } from "./auth.schema";
import * as AuthService from "./auth.service";
import { PERMISSIONS } from "../../middleware/rbac";
import { ok, badRequest, unauthorized, validationError } from "../../utils/response";

// POST /auth/login 
export function login(req: Request, res: Response): void {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    validationError(res, parsed.error);
    return;
  }

  try {
    const result = AuthService.login(parsed.data.email, parsed.data.password);
    ok(res, result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
      unauthorized(res, "Invalid email or password");
    } else {
      throw err; 
    }
  }
}

// GET /auth/me – returns the currently authenticated user's payload 
export function me(req: Request, res: Response): void {
  ok(res, req.user);
}

// GET /auth/permissions – returns permission map 
export function permissions(_req: Request, res: Response): void {
  ok(res, PERMISSIONS);
}
