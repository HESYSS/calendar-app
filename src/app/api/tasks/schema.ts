import { z } from "zod";

export const DateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const TaskCreateSchema = z.object({
  date: DateKeySchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().nonnegative().optional(),
});

export const TaskPatchSchema = z.object({
  date: DateKeySchema.optional(),
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().nonnegative().optional(),
});

export const TaskReorderSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        date: DateKeySchema,
        order: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

