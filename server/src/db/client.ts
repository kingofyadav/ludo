import postgres from "postgres";
import { config } from "../config.js";

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> {
  if (_sql === null) {
    _sql = postgres(config.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }
  return _sql;
}

export async function closeSql(): Promise<void> {
  if (_sql !== null) {
    await _sql.end();
    _sql = null;
  }
}
