import { Request, Response } from "express";
import * as RecordService from "./record.service";
import { CreateRecordSchema, UpdateRecordSchema, RecordFilterSchema } from "./record.schema";
import { ok, created, noContent, notFound, validationError } from "../../utils/response";

// GET /records  – supports filtering + pagination via query string 
export function listRecords(req: Request, res: Response): void {
  const parsed = RecordFilterSchema.safeParse(req.query);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const result = RecordService.getRecords(parsed.data);
  ok(res, result);
}

// GET /records/:id 
export function getRecord(req: Request, res: Response): void {
  const id = Number(req.params.id);
  const record = RecordService.getRecordById(id);
  if (!record) { notFound(res, "Financial record"); return; }
  ok(res, record);
}

// POST /records 
export function createRecord(req: Request, res: Response): void {
  const parsed = CreateRecordSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const record = RecordService.createRecord(req.user!.userId, parsed.data);
  created(res, record);
}

// PATCH /records/:id 
export function updateRecord(req: Request, res: Response): void {
  const parsed = UpdateRecordSchema.safeParse(req.body);
  if (!parsed.success) { validationError(res, parsed.error); return; }

  const id = Number(req.params.id);
  const updated = RecordService.updateRecord(id, parsed.data);
  if (!updated) { notFound(res, "Financial record"); return; }
  ok(res, updated);
}

// DELETE /records/:id 
export function deleteRecord(req: Request, res: Response): void {
  const id = Number(req.params.id);
  const deleted = RecordService.softDeleteRecord(id);
  if (!deleted) { notFound(res, "Financial record"); return; }
  noContent(res);
}
