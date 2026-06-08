import { getSql } from "../client.js";
import type { GameEvent } from "../../../../core/types/index.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bot ids look like "bot_<uuid>" and the match_events.player_id column is UUID,
// so we must store NULL for bot-originated events to avoid a PG cast error.
function toPlayerUuid(id: string | null | undefined): string | null {
  if (!id) return null;
  return UUID_RE.test(id) ? id : null;
}

export async function insertMatchEvent(matchId: string, event: GameEvent): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO match_events (id, match_id, tick, timestamp, player_id, event_type, payload)
    VALUES (
      ${event.id},
      ${matchId},
      ${event.tick},
      ${event.timestamp},
      ${toPlayerUuid(event.playerId)},
      ${event.type},
      ${JSON.stringify(event.payload)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function insertMatchEvents(matchId: string, events: GameEvent[]): Promise<void> {
  if (events.length === 0) return;
  const sql = getSql();

  const rows = events.map((e) => ({
    id: e.id,
    match_id: matchId,
    tick: e.tick,
    timestamp: e.timestamp,
    player_id: toPlayerUuid(e.playerId),
    event_type: e.type,
    payload: JSON.stringify(e.payload),
  }));

  for (const row of rows) {
    await sql`
      INSERT INTO match_events (id, match_id, tick, timestamp, player_id, event_type, payload)
      VALUES (${row.id}, ${row.match_id}, ${row.tick}, ${row.timestamp}, ${row.player_id}, ${row.event_type}, ${row.payload})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export async function getMatchEvents(matchId: string): Promise<GameEvent[]> {
  const sql = getSql();
  const rows = await sql<Array<{
    id: string;
    match_id: string;
    tick: number;
    timestamp: number;
    player_id: string | null;
    event_type: string;
    payload: string;
  }>>`
    SELECT * FROM match_events WHERE match_id = ${matchId} ORDER BY tick ASC
  `;

  return rows.map((r) => ({
    id: r.id,
    tick: r.tick,
    timestamp: Number(r.timestamp),
    playerId: r.player_id ?? "",
    type: r.event_type as GameEvent["type"],
    payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
  }));
}
