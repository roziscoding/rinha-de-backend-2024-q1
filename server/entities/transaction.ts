import { z } from "../deps.ts";

export const Transaction = z.object({
  id: z.string().uuid(),
  valor: z.number().int().positive(),
  tipo: z.enum(["c", "d"]),
  descricao: z.string(),
  realizada_em: z.date(),
  client_id: z.number(),
});

export type Transaction = z.infer<typeof Transaction>;

export const TransactionCreationParams = Transaction.omit({ id: true, realizada_em: true, client_id: true });
export type TransactionCreationParams = z.infer<typeof TransactionCreationParams>;
