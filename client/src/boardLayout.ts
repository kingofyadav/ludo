import type { Color } from './types'

export const CELL_SIZE = 40

// Outer ring nodes 0-51
const OUTER_RING: Record<number, [number, number]> = {
  0: [1, 6],
  1: [2, 6],
  2: [3, 6],
  3: [4, 6],
  4: [5, 6],
  5: [6, 5],
  6: [6, 4],
  7: [6, 3],
  8: [6, 2],
  9: [6, 1],
  10: [6, 0],
  11: [7, 0],
  12: [8, 0],
  13: [8, 1],
  14: [8, 2],
  15: [8, 3],
  16: [8, 4],
  17: [8, 5],
  18: [9, 6],
  19: [10, 6],
  20: [11, 6],
  21: [12, 6],
  22: [13, 6],
  23: [14, 6],
  24: [14, 7],
  25: [14, 8],
  26: [13, 8],
  27: [12, 8],
  28: [11, 8],
  29: [10, 8],
  30: [9, 8],
  31: [8, 9],
  32: [8, 10],
  33: [8, 11],
  34: [8, 12],
  35: [8, 13],
  36: [8, 14],
  37: [7, 14],
  38: [6, 14],
  39: [6, 13],
  40: [6, 12],
  41: [6, 11],
  42: [6, 10],
  43: [6, 9],
  44: [5, 8],
  45: [4, 8],
  46: [3, 8],
  47: [2, 8],
  48: [1, 8],
  49: [0, 8],
  50: [0, 7],
  51: [0, 6],
}

// Home column nodes 52-71
const HOME_COLUMNS: Record<number, [number, number]> = {
  // RED (52-56): col=1-5, row=7
  52: [1, 7],
  53: [2, 7],
  54: [3, 7],
  55: [4, 7],
  56: [5, 7],
  // GREEN (57-61): col=7, row=1-5
  57: [7, 1],
  58: [7, 2],
  59: [7, 3],
  60: [7, 4],
  61: [7, 5],
  // YELLOW (62-66): col=9-13, row=7
  62: [13, 7],
  63: [12, 7],
  64: [11, 7],
  65: [10, 7],
  66: [9, 7],
  // BLUE (67-71): col=7, row=9-13
  67: [7, 13],
  68: [7, 12],
  69: [7, 11],
  70: [7, 10],
  71: [7, 9],
}

// Center node 72
const CENTER: Record<number, [number, number]> = {
  72: [7, 7],
}

// Pocket nodes 73-88 — each color's pocket sits at the FOUR CORNERS of the
// 4×4 inner-white square that lives inside its 6×6 corner quadrant.
// Inner white squares:
//   RED    cols 1-4, rows 1-4   (top-left quadrant)
//   GREEN  cols 10-13, rows 1-4 (top-right quadrant)
//   YELLOW cols 10-13, rows 10-13 (bottom-right quadrant)
//   BLUE   cols 1-4, rows 10-13 (bottom-left quadrant)
const POCKETS: Record<number, [number, number]> = {
  // RED pockets 73-76
  73: [1, 1],
  74: [4, 1],
  75: [1, 4],
  76: [4, 4],
  // GREEN pockets 77-80
  77: [10, 1],
  78: [13, 1],
  79: [10, 4],
  80: [13, 4],
  // YELLOW pockets 81-84
  81: [10, 10],
  82: [13, 10],
  83: [10, 13],
  84: [13, 13],
  // BLUE pockets 85-88
  85: [1, 10],
  86: [4, 10],
  87: [1, 13],
  88: [4, 13],
}

const ALL_NODES: Record<number, [number, number]> = {
  ...OUTER_RING,
  ...HOME_COLUMNS,
  ...CENTER,
  ...POCKETS,
}

export function getNodePosition(nodeId: number): { col: number; row: number } | null {
  const pos = ALL_NODES[nodeId]
  if (!pos) return null
  return { col: pos[0], row: pos[1] }
}

export function nodeToPixel(nodeId: number): { x: number; y: number } | null {
  const pos = getNodePosition(nodeId)
  if (!pos) return null
  return {
    x: pos.col * CELL_SIZE + CELL_SIZE / 2,
    y: pos.row * CELL_SIZE + CELL_SIZE / 2,
  }
}

export const COLOR_HEX: Record<Color, string> = {
  RED: '#ef4444',
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  BLUE: '#3b82f6',
}

export const COLOR_LIGHT_HEX: Record<Color, string> = {
  RED: '#fca5a5',
  GREEN: '#86efac',
  YELLOW: '#fde047',
  BLUE: '#93c5fd',
}

export const SAFE_NODES: Set<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47])

export const START_NODES: Record<Color, number> = {
  RED: 0,
  GREEN: 13,
  YELLOW: 26,
  BLUE: 39,
}

// Map token ID prefix to pocket node IDs
export const TOKEN_POCKET_NODES: Record<string, number> = {
  RED_0: 73,
  RED_1: 74,
  RED_2: 75,
  RED_3: 76,
  GREEN_0: 77,
  GREEN_1: 78,
  GREEN_2: 79,
  GREEN_3: 80,
  YELLOW_0: 81,
  YELLOW_1: 82,
  YELLOW_2: 83,
  YELLOW_3: 84,
  BLUE_0: 85,
  BLUE_1: 86,
  BLUE_2: 87,
  BLUE_3: 88,
}
