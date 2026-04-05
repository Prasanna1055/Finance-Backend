import { Router } from "express";
import * as AuthController from "./auth.controller";
import { authenticate } from "../../middleware/auth";

const router = Router();

// POST /auth/login  — public 
router.post("/login", AuthController.login);

// GET  /auth/me     — requires valid token 
router.get("/me", authenticate, AuthController.me);

// GET  /auth/permissions — public reference 
router.get("/permissions", AuthController.permissions);

export default router;
