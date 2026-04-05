import { Request, Response } from "express";
import * as DashboardService from "./dashboard.service";
import { ok, badRequest } from "../../utils/response";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /dashboard/summary  – full dashboard payload 
export function getSummary(_req: Request, res: Response): void {
  ok(res, DashboardService.getDashboardSummary());
}

// GET /dashboard/totals  – optionally filter by date range 
export function getTotals(req: Request, res: Response): void {
  const { date_from, date_to } = req.query as Record<string, string | undefined>;

  if (date_from || date_to) {
    if (!date_from || !date_to) {
      badRequest(res, "Both date_from and date_to are required for a range query");
      return;
    }
    if (!ISO_DATE.test(date_from) || !ISO_DATE.test(date_to)) {
      badRequest(res, "Dates must be in YYYY-MM-DD format");
      return;
    }
    if (date_from > date_to) {
      badRequest(res, "date_from must be on or before date_to");
      return;
    }
    ok(res, DashboardService.getTotalsByRange(date_from, date_to));
  } else {
    ok(res, DashboardService.getTotals());
  }
}

// GET /dashboard/categories  – per-category breakdown 
export function getCategoryTotals(_req: Request, res: Response): void {
  ok(res, DashboardService.getCategoryTotals());
}

// GET /dashboard/trends?months=12  – monthly income vs expense trends 
export function getMonthlyTrends(req: Request, res: Response): void {
  const months = Number(req.query.months ?? 12);

  if (!Number.isInteger(months) || months < 1 || months > 60) {
    badRequest(res, "months must be an integer between 1 and 60");
    return;
  }

  ok(res, DashboardService.getMonthlyTrends(months));
}

// GET /dashboard/recent?limit=10  – most recent transactions 
export function getRecentActivity(req: Request, res: Response): void {
  const limit = Number(req.query.limit ?? 10);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    badRequest(res, "limit must be an integer between 1 and 100");
    return;
  }

  ok(res, DashboardService.getRecentActivity(limit));
}
