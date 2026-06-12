const { Pool } = require("pg");
const { config } = require("../config/env");

let pool;

function createPool(appConfig = config) {
  if (!appConfig.databaseUrl) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL");
  }

  return new Pool({
    connectionString: appConfig.databaseUrl,
    ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(work) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  createPool,
  query,
  withTransaction,
  closePool
};
