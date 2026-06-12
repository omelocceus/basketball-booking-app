const { createApp } = require("./src/http/app");
const { config } = require("./src/config/env");
const { closePool } = require("./src/db/pool");

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);