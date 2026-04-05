import { Request, Response } from "express";
import * as UserService from "./user.service";
import { CreateUserSchema, UpdateUserSchema } from "./user.schema";
import {
  ok, created, noContent,
  notFound, conflict, validationError, forbidden,
} from "../../utils/response";

// GET /users 
export function listUsers(req: Request, res: Response): void {
  ok(res, UserService.getAllUsers());
}

// GET /users/:id 
export function getUser(req: Request, res: Response): void {
  const id = Number(req.params.id);
  const user = UserService.getUserById(id);
  if (!user) { notFound(res, "User"); return; }
  ok(res, user);
}

// POST /users 
export function createUser(req: Request, res: Response): void {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  try {
    const user = UserService.createUser(parsed.data);
    created(res, user);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "EMAIL_IN_USE") {
      conflict(res, "A user with this email already exists");
    } else throw err;
  }
}

// PATCH /users/:id 
export function updateUser(req: Request, res: Response): void {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const id = Number(req.params.id);

  if (parsed.data.role === "admin" && req.user?.role !== "admin") {
    forbidden(res, "Only admins can assign the admin role");
    return;
  }

  const updated = UserService.updateUser(id, parsed.data);
  if (!updated) { notFound(res, "User"); return; }
  ok(res, updated);
}

// DELETE /users/:id — deactivates
export function deactivateUser(req: Request, res: Response): void {
  const id = Number(req.params.id);

  // Prevent self-deactivation
  if (req.user?.userId === id) {
    forbidden(res, "You cannot deactivate your own account");
    return;
  }

  const success = UserService.deactivateUser(id);
  if (!success) { notFound(res, "User"); return; }
  noContent(res);
}
