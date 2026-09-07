require("dotenv").config({ quiet: true });
const mysql = require("mysql2/promise");

const config = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "beatnest",
  password: process.env.DB_PASSWORD || "beatnest_pass",
  database: process.env.DB_NAME || "beatnest",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
  decimalNumbers: true,
  dateStrings: true,
};

let pool = null;

function getPool() {
  if (!pool) pool = mysql.createPool(config);
  return pool;
}

async function withConnection(fn) {
  const conn = await getPool().getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

module.exports = { getPool, withConnection, config };