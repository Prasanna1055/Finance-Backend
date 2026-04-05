import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a digit");

export const CreateUserSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters").max(100),
  email:    z.string().email("Must be a valid email"),
  password: passwordSchema,
  role:     z.enum(["admin", "analyst", "viewer"]),
});

export const UpdateUserSchema = z.object({
  name:   z.string().min(2).max(100).optional(),
  role:   z.enum(["admin", "analyst", "viewer"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
