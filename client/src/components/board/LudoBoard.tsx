import React, { useState, useMemo } from 'react'
import type { GameState, Token as TokenType, Color } from '../../types'
import {
  CELL_SIZE,
  nodeToPixel,
  COLOR_HEX,
  COLOR_LIGHT_HEX,
  SAFE_NODES,
  START_NODES,
  TOKEN_POCKET_NODES,
} from '../../boardLayout'
import { Token } from './Token'

const BOARD_SIZE = 15
const SVG_SIZE = BOARD_SIZE * CELL_SIZE // 600

interface LudoBoardProps {
  state: GameState
  myPlayerId: string
  onRoll: () => void
  onMove: (tokenId: string) => void
  onSkip: () => void
}

type CellType =
  | { kind: 'corner'; color: Color }
  | { kind: 'innerHome'; color: Color }
  | { kind: 'homeCol'; color: Color }
  | { kind: 'center' }
  | { kind: 'safe'; safeColor?: Color }
  | { kind: 'start'; color: Color }
  | { kind: 'normal' }
  | { kind: 'empty' }

function getCellType(col: number, row: number): CellType {
  // Each corner is a 6×6 colored quadrant. Inside sits a 4×4 white "inner home"
  // (cols 1-4 / 10-13, rows 1-4 / 10-13). The 4 pocket pawns rest on the 4
  // corners of that inner square (handled by pocketPlates).
  const isInnerTL = row >= 1 && row <= 4 && col >= 1 && col <= 4
  const isInnerTR = row >= 1 && row <= 4 && col >= 10 && col <= 13
  const isInnerBR = row >= 10 && row <= 13 && col >= 10 && col <= 13
  const isInnerBL = row >= 10 && row <= 13 && col >= 1 && col <= 4

  if (isInnerTL) return { kind: 'innerHome', color: 'RED' }
  if (isInnerTR) return { kind: 'innerHome', color: 'GREEN' }
  if (isInnerBR) return { kind: 'innerHome', color: 'YELLOW' }
  if (isInnerBL) return { kind: 'innerHome', color: 'BLUE' }

  // Corner home areas — each color sits adjacent to its start square on the outer ring.
  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) return { kind: 'corner', color: 'RED' }
  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) return { kind: 'corner', color: 'GREEN' }
  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) return { kind: 'corner', color: 'YELLOW' }
  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) return { kind: 'corner', color: 'BLUE' }

  // Center area
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) return { kind: 'center' }

  // Home columns/rows — each color's home column lives on the arm adjacent
  // to its corner. Server-side home-column node ids:
  // RED 52–56 on (1..5,7), GREEN 57–61 on (7,1..5),
  // YELLOW 62–66 on (9..13,7), BLUE 67–71 on (7,9..13).
  if (row === 7 && col >= 1 && col <= 5) return { kind: 'homeCol', color: 'RED' }
  if (col === 7 && row >= 1 && row <= 5) return { kind: 'homeCol', color: 'GREEN' }
  if (row === 7 && col >= 9 && col <= 13) return { kind: 'homeCol', color: 'YELLOW' }
  if (col === 7 && row >= 9 && row <= 13) return { kind: 'homeCol', color: 'BLUE' }

  // Check if this cell corresponds to a safe node
  for (const nodeId of SAFE_NODES) {
    const pixel = nodeToPixel(nodeId)
    if (pixel) {
      const nodeCol = Math.floor(pixel.x / CELL_SIZE)
      const nodeRow = Math.floor(pixel.y / CELL_SIZE)
      if (nodeCol === col && nodeRow === row) {
        // Determine color association
        let safeColor: Color | undefined
        if (nodeId === 0) safeColor = 'RED'
        else if (nodeId === 13) safeColor = 'GREEN'
        else if (nodeId === 26) safeColor = 'YELLOW'
        else if (nodeId === 39) safeColor = 'BLUE'
        return { kind: 'safe', safeColor }
      }
    }
  }

  // Check start nodes
  for (const [color, nodeId] of Object.entries(START_NODES) as [Color, number][]) {
    const pixel = nodeToPixel(nodeId)
    if (pixel) {
      const nodeCol = Math.floor(pixel.x / CELL_SIZE)
      const nodeRow = Math.floor(pixel.y / CELL_SIZE)
      if (nodeCol === col && nodeRow === row) {
        return { kind: 'start', color }
      }
    }
  }

  // Remaining outer ring and path cells
  // cols 6 or 8 rows 0-14 and row 6 or 8 cols 0-14 form the ring path
  if (
    (col === 6 && row >= 0 && row <= 14) ||
    (col === 8 && row >= 0 && row <= 14) ||
    (row === 6 && col >= 0 && col <= 14) ||
    (row === 8 && col >= 0 && col <= 14) ||
    (col === 7 && (row === 0 || row === 14)) ||
    (row === 7 && (col === 0 || col === 14))
  ) {
    return { kind: 'normal' }
  }

  return { kind: 'empty' }
}

function getCellFill(cellType: CellType): string {
  switch (cellType.kind) {
    case 'corner':
      return COLOR_HEX[cellType.color]
    case 'innerHome':
      return '#ffffff'
    case 'homeCol':
      return COLOR_LIGHT_HEX[cellType.color]
    case 'center':
      return 'transparent'
    case 'safe':
      return '#ffffff'
    case 'start':
      return `${COLOR_HEX[cellType.color]}30`
    case 'normal':
      return '#f9fafb'
    case 'empty':
      return '#f3f4f6'
  }
}

function getTokenColor(tokenId: string, state: GameState): Color | null {
  const player = state.players.find((p) => {
    const prefix = p.color
    return tokenId.startsWith(prefix)
  })
  return player ? player.color : null
}

function getTokenNodeId(token: TokenType): number {
  if (token.status === 'POCKET') {
    return TOKEN_POCKET_NODES[token.tokenId] ?? -1
  }
  return token.nodeId
}

// Group tokens by their rendered node position
function groupTokensByNode(
  tokens: TokenType[],
  state: GameState,
): Map<number, TokenType[]> {
  const groups = new Map<number, TokenType[]>()
  for (const token of tokens) {
    const nodeId = getTokenNodeId(token)
    if (nodeId === -1) continue
    const color = getTokenColor(token.tokenId, state)
    if (!color) continue
    const existing = groups.get(nodeId) ?? []
    existing.push(token)
    groups.set(nodeId, existing)
  }
  return groups
}

// Small offsets for stacked tokens
const STACK_OFFSETS: [number, number][] = [
  [-6, -6],
  [6, -6],
  [-6, 6],
  [6, 6],
]

export function LudoBoard({ state, myPlayerId, onMove }: LudoBoardProps) {
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)

  const isMyTurn = state.activePlayer === myPlayerId
  const validMoveTokenIds = useMemo(
    () => new Set(state.validMoves.map((m) => m.tokenId)),
    [state.validMoves],
  )

  const tokenGroups = useMemo(() => groupTokensByNode(state.tokens, state), [state])

  function handleTokenClick(tokenId: string) {
    if (!isMyTurn) return
    if (!validMoveTokenIds.has(tokenId)) return

    if (selectedTokenId === tokenId) {
      // Confirm move
      onMove(tokenId)
      setSelectedTokenId(null)
    } else {
      setSelectedTokenId(tokenId)
    }
  }

  // Render board cells
  const cells = useMemo(() => {
    const result: React.ReactElement[] = []
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cellType = getCellType(col, row)
        const fill = getCellFill(cellType)
        const x = col * CELL_SIZE
        const y = row * CELL_SIZE

        if (cellType.kind === 'center') continue // rendered as triangles

        // Skip grid stroke inside the colored corner blocks so they look like
        // a single colored quadrant with a clean white inner home.
        const skipStroke = cellType.kind === 'corner' || cellType.kind === 'innerHome'
        result.push(
          <rect
            key={`${col}-${row}`}
            x={x}
            y={y}
            width={CELL_SIZE}
            height={CELL_SIZE}
            fill={fill}
            stroke={skipStroke ? 'none' : '#d1d5db'}
            strokeWidth={skipStroke ? 0 : 0.5}
          />,
        )

        // Safe node star marker
        if (cellType.kind === 'safe') {
          result.push(
            <text
              key={`star-${col}-${row}`}
              x={x + CELL_SIZE / 2}
              y={y + CELL_SIZE / 2 + 5}
              textAnchor="middle"
              fontSize="16"
              fill={cellType.safeColor ? COLOR_HEX[cellType.safeColor] : '#6b7280'}
            >
              ★
            </text>,
          )
        }

        // Start node tint arrow
        if (cellType.kind === 'start') {
          result.push(
            <circle
              key={`start-dot-${col}-${row}`}
              cx={x + CELL_SIZE / 2}
              cy={y + CELL_SIZE / 2}
              r="6"
              fill={COLOR_HEX[cellType.color]}
              opacity="0.4"
            />,
          )
        }
      }
    }
    return result
  }, [])

  // Center triangles in the 3×3 center (rows 6-8, cols 6-8) = 120×120 at (240,240)
  const centerTriangles = (
    <g transform="translate(240,240)">
      {/* Outer border rect */}
      <rect x="0" y="0" width="120" height="120" fill="white" stroke="#d1d5db" strokeWidth="0.5" />
      {/* Each triangle matches the color whose home column points into it. */}
      {/* GREEN top — GREEN home column runs down the top arm into center */}
      <polygon points="0,0 120,0 60,60" fill={COLOR_HEX.GREEN} />
      {/* YELLOW right — YELLOW home column runs in from the right arm */}
      <polygon points="120,0 120,120 60,60" fill={COLOR_HEX.YELLOW} />
      {/* BLUE bottom — BLUE home column rises up the bottom arm into center */}
      <polygon points="120,120 0,120 60,60" fill={COLOR_HEX.BLUE} />
      {/* RED left — RED home column runs in from the left arm */}
      <polygon points="0,120 0,0 60,60" fill={COLOR_HEX.RED} />
      {/* Center star */}
      <text x="60" y="66" textAnchor="middle" fontSize="22" fill="white" opacity="0.9">
        ★
      </text>
    </g>
  )

  // Colored frame around each 4×4 inner home + tiny color crest
  const innerHomeFrames = useMemo(() => {
    const frames: React.ReactElement[] = []
    const homes: { color: Color; col: number; row: number }[] = [
      { color: 'RED', col: 1, row: 1 },
      { color: 'GREEN', col: 10, row: 1 },
      { color: 'YELLOW', col: 10, row: 10 },
      { color: 'BLUE', col: 1, row: 10 },
    ]
    for (const { color, col, row } of homes) {
      const x = col * CELL_SIZE
      const y = row * CELL_SIZE
      const size = 4 * CELL_SIZE
      frames.push(
        <g key={`home-${color}`}>
          {/* Colored frame around inner home */}
          <rect
            x={x}
            y={y}
            width={size}
            height={size}
            fill="none"
            stroke={COLOR_HEX[color]}
            strokeWidth="3"
            rx="4"
            ry="4"
          />
          {/* Inner subtle inset */}
          <rect
            x={x + 4}
            y={y + 4}
            width={size - 8}
            height={size - 8}
            fill="none"
            stroke={COLOR_HEX[color]}
            strokeOpacity="0.25"
            strokeWidth="1"
            rx="2"
            ry="2"
          />
        </g>,
      )
    }
    return frames
  }, [])

  // Pocket circles for each corner home area
  const pocketCircles = useMemo(() => {
    const circles: React.ReactElement[] = []
    const corners: { color: Color; positions: [number, number][] }[] = [
      { color: 'RED',    positions: [[1, 1], [4, 1], [1, 4], [4, 4]] },
      { color: 'GREEN',  positions: [[10, 1], [13, 1], [10, 4], [13, 4]] },
      { color: 'YELLOW', positions: [[10, 10], [13, 10], [10, 13], [13, 13]] },
      { color: 'BLUE',   positions: [[1, 10], [4, 10], [1, 13], [4, 13]] },
    ]

    for (const { color, positions } of corners) {
      for (const [col, row] of positions) {
        const cx = col * CELL_SIZE + CELL_SIZE / 2
        const cy = row * CELL_SIZE + CELL_SIZE / 2
        circles.push(
          <g key={`pocket-${color}-${col}-${row}`}>
            {/* Colored pocket plate */}
            <circle cx={cx} cy={cy} r={CELL_SIZE / 2 - 3} fill={COLOR_HEX[color]} opacity="0.18" />
            <circle
              cx={cx}
              cy={cy}
              r={CELL_SIZE / 2 - 6}
              fill="white"
              stroke={COLOR_HEX[color]}
              strokeWidth="2.5"
            />
          </g>,
        )
      }
    }
    return circles
  }, [])

  // Render tokens
  const tokenElements = useMemo(() => {
    const elements: React.ReactElement[] = []

    for (const [nodeId, tokens] of tokenGroups) {
      const pixel = nodeToPixel(nodeId)
      if (!pixel) continue

      const count = tokens.length
      const useOffsets = count > 1

      tokens.forEach((token, idx) => {
        const color = getTokenColor(token.tokenId, state)
        if (!color) return

        const offset = useOffsets ? STACK_OFFSETS[idx] ?? [0, 0] : [0, 0]
        const tx = pixel.x + offset[0]
        const ty = pixel.y + offset[1]
        const radius = useOffsets ? 10 : 13
        const isValid = isMyTurn && validMoveTokenIds.has(token.tokenId)
        const isSelected = selectedTokenId === token.tokenId

        elements.push(
          <Token
            key={token.tokenId}
            color={color}
            isValid={isValid}
            isSelected={isSelected}
            onClick={() => handleTokenClick(token.tokenId)}
            x={tx}
            y={ty}
            radius={radius}
          />,
        )
      })
    }

    return elements
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenGroups, isMyTurn, validMoveTokenIds, selectedTokenId, state])

  return (
    <div className="relative inline-block">
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
        className="shadow-2xl rounded border border-gray-300"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Background */}
        <rect width={SVG_SIZE} height={SVG_SIZE} fill="#e5e7eb" />

        {/* Board cells */}
        {cells}

        {/* Inner-home frames */}
        {innerHomeFrames}

        {/* Center triangles */}
        {centerTriangles}

        {/* Pocket plates */}
        {pocketCircles}

        {/* Grid outer border */}
        <rect
          x="0"
          y="0"
          width={SVG_SIZE}
          height={SVG_SIZE}
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
        />

        {/* Tokens */}
        {tokenElements}
      </svg>

      {/* Deselect overlay hint */}
      {selectedTokenId && (
        <button
          type="button"
          className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded"
          onClick={() => setSelectedTokenId(null)}
        >
          Cancel
        </button>
      )}
    </div>
  )
}
