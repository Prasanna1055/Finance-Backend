import db from "../../config/database";
import { DashboardSummary, CategoryTotal, MonthlyTrend, FinancialRecord, FinancialRecordDTO } from "../../types";
import { fromCents } from "../../utils/response";

interface RawCategoryRow {
  category: string;
  type: "income" | "expense";
  total: number;
}

interface RawMonthRow {
  month: string;
  income: number;
  expense: number;
}

function toDTO(row: FinancialRecord): FinancialRecordDTO {
  return {
    id:         row.id,
    user_id:    row.user_id,
    amount:     fromCents(row.amount),
    type:       row.type,
    category:   row.category,
    date:       row.date,
    notes:      row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}


export function getTotals(): { total_income: number; total_expenses: number; net_balance: number } {
  const rows = db
    .prepare(
      `SELECT type, SUM(amount) AS total
       FROM financial_records
       WHERE deleted_at IS NULL
       GROUP BY type`,
    )
    .all() as { type: string; total: number }[];

  let income  = 0;
  let expense = 0;

  for (const r of rows) {
    if (r.type === "income")  income  = r.total;
    if (r.type === "expense") expense = r.total;
  }

  return {
    total_income:   fromCents(income),
    total_expenses: fromCents(expense),
    net_balance:    fromCents(income - expense),
  };
}

export function getCategoryTotals(): CategoryTotal[] {
  const rows = db
    .prepare(
      `SELECT category, type, SUM(amount) AS total
       FROM financial_records
       WHERE deleted_at IS NULL
       GROUP BY category, type
       ORDER BY total DESC`,
    )
    .all() as RawCategoryRow[];

  return rows.map((r) => ({
    category: r.category,
    type:     r.type,
    total:    fromCents(r.total),
  }));
}

export function getMonthlyTrends(months = 12): MonthlyTrend[] {
  const rows = db
    .prepare(
      `SELECT
         strftime('%Y-%m', date) AS month,
         SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM financial_records
       WHERE deleted_at IS NULL
         AND date >= date('now', ? || ' months')
       GROUP BY month
       ORDER BY month ASC`,
    )
    .all(`-${months}`) as RawMonthRow[];

  return rows.map((r) => ({
    month:   r.month,
    income:  fromCents(r.income),
    expense: fromCents(r.expense),
    net:     fromCents(r.income - r.expense),
  }));
}

export function getRecentActivity(limit = 10): FinancialRecordDTO[] {
  const rows = db
    .prepare(
      `SELECT * FROM financial_records
       WHERE deleted_at IS NULL
       ORDER BY date DESC, created_at DESC
       LIMIT ?`,
    )
    .all(limit) as FinancialRecord[];

  return rows.map(toDTO);
}


export function getDashboardSummary(): DashboardSummary {
  return {
    ...getTotals(),
    category_totals: getCategoryTotals(),
    monthly_trends:  getMonthlyTrends(12),
    recent_activity: getRecentActivity(10),
  };
}


export function getTotalsByRange(
  dateFrom: string,
  dateTo: string,
): { total_income: number; total_expenses: number; net_balance: number } {
  const rows = db
    .prepare(
      `SELECT type, SUM(amount) AS total
       FROM financial_records
       WHERE deleted_at IS NULL
         AND date BETWEEN ? AND ?
       GROUP BY type`,
    )
    .all(dateFrom, dateTo) as { type: string; total: number }[];

  let income  = 0;
  let expense = 0;

  for (const r of rows) {
    if (r.type === "income")  income  = r.total;
    if (r.type === "expense") expense = r.total;
  }

  return {
    total_income:   fromCents(income),
    total_expenses: fromCents(expense),
    net_balance:    fromCents(income - expense),
  };
}
