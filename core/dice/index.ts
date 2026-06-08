export interface DiceOptions {
  mode: "OFFLINE" | "SEEDED";
  seed?: number;
}

export interface DiceEngine {
  roll(): number; // 1–6
}

/**
 * Mulberry32 PRNG — fast, simple, deterministic 32-bit PRNG seeded with a number.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDice(opts: DiceOptions): DiceEngine {
  if (opts.mode === "SEEDED") {
    const seed = opts.seed ?? 0;
    const prng = mulberry32(seed);
    return {
      roll(): number {
        return Math.floor(prng() * 6) + 1;
      },
    };
  }

  // OFFLINE mode: use Math.random()
  return {
    roll(): number {
      return Math.floor(Math.random() * 6) + 1;
    },
  };
}
