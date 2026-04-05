import { Response } from "express";
import { ZodError } from "zod";


export function ok<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function badRequest(res: Response, message: string, details?: unknown): void {
  res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message, details } });
}

export function unauthorized(res: Response, message = "Authentication required"): void {
  res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message } });
}

export function forbidden(res: Response, message = "Insufficient permissions"): void {
  res.status(403).json({ success: false, error: { code: "FORBIDDEN", message } });
}

export function notFound(res: Response, resource = "Resource"): void {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `${resource} not found` } });
}

export function conflict(res: Response, message: string): void {
  res.status(409).json({ success: false, error: { code: "CONFLICT", message } });
}

export function serverError(res: Response, message = "Internal server error"): void {
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message } });
}

export function validationError(res: Response, error: ZodError): void {
  const details = error.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));
  badRequest(res, "Validation failed", details);
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
