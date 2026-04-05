import { Router } from "express";
import * as RecordController from "./record.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";

const router = Router();

// All record routes require authentication
router.use(authenticate);

// Read access: viewer and above
router.get("/",     requireRole("viewer"),  RecordController.listRecords);
router.get("/:id",  requireRole("viewer"),  RecordController.getRecord);

// Write access: analyst and above
router.post("/",    requireRole("analyst"), RecordController.createRecord);

// Modify / delete: admin only
router.patch("/:id",  requireRole("admin"), RecordController.updateRecord);
router.delete("/:id", requireRole("admin"), RecordController.deleteRecord);

export default router;
