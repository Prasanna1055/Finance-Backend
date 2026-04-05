import { Router } from "express";
import * as UserController from "./user.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";

const router = Router();

// All user management routes require authentication + admin role
router.use(authenticate, requireRole("admin"));

router.get("/",      UserController.listUsers);
router.get("/:id",   UserController.getUser);
router.post("/",     UserController.createUser);
router.patch("/:id", UserController.updateUser);
router.delete("/:id",UserController.deactivateUser);

export default router;
