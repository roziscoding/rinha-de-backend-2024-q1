import { HttpError } from "./HttpError.ts";
import { type AppConfig } from "./config.ts";
import { getConnection } from "./database/connection.ts";
import { Oak, z } from "./deps.ts";
import { Transaction, TransactionCreationParams } from "./entities/transaction.ts";

export async function getApp(config: AppConfig) {
  const app = new Oak.Application();
  const db = await getConnection(config.db);

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof HttpError) {
        ctx.response.status = err.status;
        ctx.response.body = { status: err.status, code: err.code, message: err.message, details: err.details };
        return;
      }

      if (err instanceof z.ZodError) {
        ctx.response.status = 422;
        ctx.response.body = { status: 422, code: "invalid_parameters", details: err.errors };
        return;
      }

      console.error(err);
      ctx.response.status = 500;
      ctx.response.body = { status: 500, code: "internal_error", message: "Internal server error" };
    }
  });

  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.request.method} ${ctx.request.url} - ${ctx.response.status} - ${ms}ms`);
  });

  const router = new Oak.Router();

  router.post("/clientes/:id/transacoes", async (ctx) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(ctx.params);
    await db
      .transaction()
      .setIsolationLevel("repeatable read")
      .execute(async (trx) => {
        const client = await db.selectFrom("client").selectAll().where("id", "=", id).executeTakeFirst();

        if (!client) throw new HttpError(404, "client_not_found", "Client not found");

        const { descricao, tipo, valor } = TransactionCreationParams.parse(await ctx.request.body.json());

        if (tipo === "d" && Math.abs(client.balance - valor) > client.credit_limit) {
          const amountExceeded = Math.abs(client.credit_limit + client.balance - valor);
          throw new HttpError(
            403,
            "limit_exceeded",
            `Transaction exceeds client limit by ${amountExceeded}`,
            {
              valorExcedente: amountExceeded,
              saldo: client.balance,
              limite: client.credit_limit,
              limiteRestante: client.credit_limit + client.balance,
            },
          );
        }

        const transaction = {
          id: crypto.randomUUID(),
          descricao,
          tipo,
          valor,
          realizada_em: new Date(),
          client_id: id,
        } satisfies Transaction;

        await trx
          .insertInto("transaction")
          .values(transaction)
          .executeTakeFirst();

        const newBalance = client.balance + (tipo === "d" ? -valor : valor);

        await trx.updateTable("client")
          .set("balance", newBalance)
          .where(
            "id",
            "=",
            id,
          )
          .execute();

        ctx.response.status = 200;
        ctx.response.body = { limite: client.credit_limit, saldo: newBalance };
      });
  });

  router.get("/clientes/:id/extrato", async (ctx) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(ctx.params);

    const clientTransactions = await db
      .selectFrom("client")
      .leftJoin("transaction", "client.id", "transaction.client_id")
      .select([
        "client.id",
        "client.credit_limit",
        "client.balance",
        "transaction.client_id",
        "transaction.valor as valor",
        "transaction.tipo as tipo",
        "transaction.descricao as descricao",
        "transaction.realizada_em as realizada_em",
      ])
      .where("client.id", "=", id)
      .limit(10)
      .execute();

    const [client] = clientTransactions;

    if (!client) throw new HttpError(404, "client_not_found", `Client with id \`${id}\` does not exist`);

    const transactions = clientTransactions.filter((t) => t.valor).map((t) => ({
      valor: t.valor,
      tipo: t.tipo,
      descricao: t.descricao,
      realizada_em: t.realizada_em,
    }));

    ctx.response.status = 200;
    ctx.response.body = {
      total: client.balance,
      data_extrato: new Date(),
      limite: client.credit_limit,
      ultimasTransacoes: transactions,
    };
  });

  router.get("/clientes", async (ctx) => {
    console.log("entered /clientes");
    const clients = await db.selectFrom("client").selectAll().execute();
    console.log("clients:", clients);
    ctx.response.status = 200;
    ctx.response.body = clients;
  });

  app.use(router.allowedMethods());
  app.use(router.routes());

  return app;
}
