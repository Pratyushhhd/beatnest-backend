// `npm run db:migrate` — applies the MySQL schema.
require("../mysql/schema").migrate()
  .then((n) => { console.log(`✔ Schema applied (${n} tables).`); process.exit(0); })
  .catch((e) => { console.error("Schema migration failed:", e.message); process.exit(1); });