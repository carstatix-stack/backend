import { z } from 'zod';

export const exploreQuerySchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
  cursor: z.string().trim().min(1).optional(),
});

export type ExploreQuery = z.infer<typeof exploreQuerySchema>;
