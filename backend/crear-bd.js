require("dotenv").config();
const { Client } = require("pg");
(async () => {
  const c = new Client({
    host: process.env.DB_HOST, port: +process.env.DB_PORT,
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: "postgres",
  });
  await c.connect();
  const r = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [process.env.DB_NAME]);
  if (r.rowCount) console.log("La base ya existe:", process.env.DB_NAME);
  else { await c.query(`CREATE DATABASE "${process.env.DB_NAME}"`); console.log("Base creada:", process.env.DB_NAME); }
  await c.end();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
