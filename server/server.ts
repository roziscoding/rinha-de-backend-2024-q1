import { getApp } from "./app.ts";
import { config } from "./config.ts";

const app = await getApp(config);

app.addEventListener("listen", ({ port }) => {
  console.log(`Listening on port ${port}`);
});

app.listen(config.server);
