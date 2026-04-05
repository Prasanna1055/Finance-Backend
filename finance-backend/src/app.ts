import express, { Request, Response } from "express";
import { initSchema } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes      from "./modules/auth/auth.routes";
import userRoutes      from "./modules/users/user.routes";
import recordRoutes    from "./modules/records/record.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

initSchema();

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/auth",      authRoutes);
app.use("/users",     userRoutes);
app.use("/records",   recordRoutes);
app.use("/dashboard", dashboardRoutes);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`✅  Finance backend running on http://localhost:${PORT}`);
    console.log(`\nRun  npm run seed  to populate sample data.\n`);
  });
}
