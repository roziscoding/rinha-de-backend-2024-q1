import { AppConfig } from "../config.ts";
import { getDB, kysely, KyselyDenoPostgresDialect, Pool, setup } from "../deps.ts";
import { Database } from "./schema.ts";

export function getConnection(config: AppConfig["db"]) {
  setup(() => {
    const dialect = new KyselyDenoPostgresDialect({
      pool: new Pool(
        {
          database: config.name,
          hostname: config.host,
          password: config.password,
          port: config.port,
          user: config.username,
        },
        10,
        true,
      ),
    });

    return new kysely.Kysely<Database>({
      dialect,
    });
  });

  return getDB<Database>();
}
