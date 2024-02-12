import "std/dotenv/load.ts";
import { z } from "./deps.ts";

// deno-lint-ignore ban-types
type Prettify<T> = { [K in keyof T]: T[K] } & {};

export const AppConfig = z.object({
  DB_HOST: z.string(),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  SERVER_PORT: z.coerce.number().default(3000),
}).transform((envs) => ({
  db: {
    host: envs.DB_HOST,
    username: envs.DB_USERNAME,
    password: envs.DB_PASSWORD,
    name: envs.DB_NAME,
    port: envs.DB_PORT,
  },
  server: {
    port: envs.SERVER_PORT,
  },
}));
export const config = AppConfig.parse(Deno.env.toObject());

export type AppConfig = Prettify<z.infer<typeof AppConfig>>;
