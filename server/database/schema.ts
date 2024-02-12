import { kysely } from "../deps.ts";
import { type Client } from "../entities/client.ts";
import { TransactionCreationParams } from "../entities/transaction.ts";

export interface TransactionTable extends TransactionCreationParams {
  id: kysely.Generated<string>;
  realizada_em: kysely.Generated<Date>;
  client_id: number;
}

export interface Database {
  transaction: TransactionTable;
  client: Client;
}
