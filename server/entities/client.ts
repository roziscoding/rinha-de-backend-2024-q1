import { z } from "../deps.ts";

export const Client = z.object({
  id: z.number(),
  credit_limit: z.number(),
  balance: z.number(),
});

export type Client = z.infer<typeof Client>;
