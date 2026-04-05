import db from "../../config/database";
import { FinancialRecord, FinancialRecordDTO, PaginatedResult } from "../../types";
import { toCents, fromCents } from "../../utils/response";
import { CreateRecordInput, UpdateRecordInput, RecordFilterInput } from "./record.schema";

function toDTO(row: FinancialRecord): FinancialRecordDTO {
  const { deleted_at, amount, ...rest } = row;
  return { ...rest, amount: fromCents(amount) };
}


export function getRecords(
  filters: RecordFilterInput,
): PaginatedResult<FinancialRecordDTO> {
  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];

  if (filters.type) {
    conditions.push("type = ?");
    params.push(filters.type);
  }

  if (filters.category) {
    conditions.push("LOWER(category) = LOWER(?)");
    params.push(filters.category);
  }

  if (filters.date_from) {
    conditions.push("date >= ?");
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    conditions.push("date <= ?");
    params.push(filters.date_to);
  }

  if (filters.search) {
    conditions.push("(LOWER(notes) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))");
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  const where = conditions.join(" AND ");

  // Total count for pagination
  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM financial_records WHERE ${where}`)
    .get(...params) as { total: number };

  const page = filters.page ?? 1;
  const pageSize = filters.page_size ?? 20;
  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT * FROM financial_records
       WHERE ${where}
       ORDER BY date DESC, created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as FinancialRecord[];

  return {
    data: rows.map(toDTO),
    pagination: {
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    },
  };
}

export function getRecordById(id: number): FinancialRecordDTO | null {
  const row = db
    .prepare("SELECT * FROM financial_records WHERE id = ? AND deleted_at IS NULL")
    .get(id) as FinancialRecord | undefined;
  return row ? toDTO(row) : null;
}

export function createRecord(
  userId: number,
  input: CreateRecordInput,
): FinancialRecordDTO {
  const result = db
    .prepare(
      `INSERT INTO financial_records (user_id, amount, type, category, date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, toCents(input.amount), input.type, input.category, input.date, input.notes ?? null);

  return getRecordById(result.lastInsertRowid as number)!;
}

export function updateRecord(
  id: number,
  input: UpdateRecordInput,
): FinancialRecordDTO | null {
  const existing = getRecordById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.amount   !== undefined) { fields.push("amount = ?");   values.push(toCents(input.amount)); }
  if (input.type     !== undefined) { fields.push("type = ?");     values.push(input.type);   }
  if (input.category !== undefined) { fields.push("category = ?"); values.push(input.category); }
  if (input.date     !== undefined) { fields.push("date = ?");     values.push(input.date);   }
  if (input.notes    !== undefined) { fields.push("notes = ?");    values.push(input.notes);  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE financial_records SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getRecordById(id);
}

export function softDeleteRecord(id: number): boolean {
  const result = db
    .prepare(
      "UPDATE financial_records SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    )
    .run(id);
  return result.changes > 0;
}
