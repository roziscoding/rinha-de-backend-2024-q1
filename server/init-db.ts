import { config } from "./config.ts";
import { getConnection } from "./database/connection.ts";
import { SCRIPT } from "./database/script.ts";

const db = await getConnection(config.db);
await SCRIPT.execute(db);
console.log("Done");
