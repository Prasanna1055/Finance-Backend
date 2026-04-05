import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CreateRecordSchema = z.object({
  amount:   z.number().positive("Amount must be positive"),
  type:     z.enum(["income", "expense"]),
  category: z.string().min(1, "Category is required").max(100),
  date:     z.string().regex(ISO_DATE, "Date must be in YYYY-MM-DD format"),
  notes:    z.string().max(500).optional(),
});

export const UpdateRecordSchema = z.object({
  amount:   z.number().positive().optional(),
  type:     z.enum(["income", "expense"]).optional(),
  category: z.string().min(1).max(100).optional(),
  date:     z.string().regex(ISO_DATE).optional(),
  notes:    z.string().max(500).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" });

export const RecordFilterSchema = z.object({
  type:      z.enum(["income", "expense"]).optional(),
  category:  z.string().optional(),
  date_from: z.string().regex(ISO_DATE, "date_from must be YYYY-MM-DD").optional(),
  date_to:   z.string().regex(ISO_DATE, "date_to must be YYYY-MM-DD").optional(),
  search:    z.string().optional(),
  page:      z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRecordInput = z.infer<typeof CreateRecordSchema>;
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>;
export type RecordFilterInput = z.infer<typeof RecordFilterSchema>;
