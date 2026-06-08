import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getSql, closeSql } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(): Promise<void> {
  const sql = getSql();
  const migrationDir = join(__dirname, "migrations");
  const migrationFile = join(migrationDir, "001_init.sql");

  const migrationSql = readFileSync(migrationFile, "utf-8");

  // Split on statement delimiter but keep track of each statement
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }

  console.log("Migrations completed successfully");
}

// Run directly when invoked as a script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => closeSql())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
