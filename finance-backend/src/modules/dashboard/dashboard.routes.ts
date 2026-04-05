import { Router } from "express";
import * as DashboardController from "./dashboard.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";

const router = Router();

// All dashboard routes: authenticated + at least viewer
router.use(authenticate, requireRole("viewer"));

router.get("/summary",    DashboardController.getSummary);
router.get("/totals",     DashboardController.getTotals);
router.get("/categories", DashboardController.getCategoryTotals);
router.get("/trends",     DashboardController.getMonthlyTrends);
router.get("/recent",     DashboardController.getRecentActivity);

export default router;
