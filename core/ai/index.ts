import { easyAI } from "./easy.js";
import { mediumAI } from "./medium.js";
import { hardAI } from "./hard.js";
import type { Action, GameState } from "../types/index.js";

export { easyAI } from "./easy.js";
export { mediumAI } from "./medium.js";
export { hardAI } from "./hard.js";

export function getBotAction(
  state: GameState,
  difficulty: "EASY" | "MEDIUM" | "HARD"
): Action {
  switch (difficulty) {
    case "EASY":
      return easyAI(state);
    case "MEDIUM":
      return mediumAI(state);
    case "HARD":
      return hardAI(state);
    default: {
      const _exhaustive: never = difficulty;
      throw new Error(`Unknown difficulty: ${String(_exhaustive)}`);
    }
  }
}
