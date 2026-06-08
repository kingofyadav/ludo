import type { EventType, GameEvent } from "../types/index.js";

export function createEvent(
  tick: number,
  playerId: string,
  type: EventType,
  payload: Record<string, unknown>
): GameEvent {
  return {
    id: crypto.randomUUID(),
    tick,
    timestamp: Date.now(),
    playerId,
    type,
    payload,
  };
}

export class EventStore {
  private events: GameEvent[] = [];

  push(event: GameEvent): void {
    this.events.push(event);
  }

  getAll(): GameEvent[] {
    return [...this.events];
  }

  getByTick(tick: number): GameEvent[] {
    return this.events.filter((e) => e.tick === tick);
  }

  getByType(type: EventType): GameEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  count(): number {
    return this.events.length;
  }

  clear(): void {
    this.events = [];
  }
}
