import { HttpError } from "./HttpError.ts";
import { type AppConfig } from "./config.ts";
import { getConnection } from "./database/connection.ts";
import { SCRIPT } from "./database/script.ts";
import { Oak, z } from "./deps.ts";
import { Transaction, TransactionCreationParams } from "./entities/transaction.ts";

export async function getApp(config: AppConfig) {
  const app = new Oak.Application();
  const db = await getConnection(config.db);

  if (config.server.runScript) await SCRIPT.execute(db);

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

      Deno.stderr.write(new TextEncoder().encode(err + "\n"));
      ctx.response.status = 500;
      ctx.response.body = { status: 500, code: "internal_error", message: "Internal server error" };
    }
  });

  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    Deno.stdout.write(
      new TextEncoder().encode(`${ctx.request.method} ${ctx.request.url} - ${ctx.response.status} - ${ms}ms\n`),
    );
  });

  const router = new Oak.Router();

  router.post("/clientes/:id/transacoes", async (ctx) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(ctx.params);
    await db
      .transaction()
      .setIsolationLevel("read committed")
      .execute(async (trx) => {
        const client = await db.selectFrom("client").selectAll().where("id", "=", id).executeTakeFirst();

        if (!client) throw new HttpError(404, "client_not_found", "Client not found");

        const { descricao, tipo, valor } = TransactionCreationParams.parse(await ctx.request.body.json());

        if (tipo === "d" && Math.abs(client.balance - valor) > client.credit_limit) {
          const amountExceeded = Math.abs(client.credit_limit + client.balance - valor);
          throw new HttpError(
            422,
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
          .set("balance", (eb) => eb("balance", "+", tipo === "d" ? -valor : valor))
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

    const client = await db.selectFrom("client").select(["balance", "credit_limit"]).where("id", "=", id)
      .executeTakeFirst();

    if (!client) throw new HttpError(404, "client_not_found", `Client with id \`${id}\` does not exist`);

    const transactions = await db
      .selectFrom("transaction")
      .select(["valor", "tipo", "descricao", "realizada_em"])
      .where("client_id", "=", id)
      .limit(10)
      .execute();

    ctx.response.status = 200;
    ctx.response.body = {
      saldo: {
        total: client.balance,
        data_extrato: new Date(),
        limite: client.credit_limit,
      },
      ultimasTransacoes: transactions,
    };
  });

  router.get("/clientes", async (ctx) => {
    const clients = await db.selectFrom("client").selectAll().execute();
    ctx.response.status = 200;
    ctx.response.body = clients;
  });

  app.use(router.allowedMethods());
  app.use(router.routes());

  return app;
}
