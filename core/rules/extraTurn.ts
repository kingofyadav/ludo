/**
 * Determines whether the current player should receive an extra turn.
 * Extra turn is granted if:
 * - The player rolled a 6, OR
 * - The player captured an opponent token
 */
export function shouldGrantExtraTurn(
  diceValue: number,
  captured: boolean
): boolean {
  return diceValue === 6 || captured;
}
