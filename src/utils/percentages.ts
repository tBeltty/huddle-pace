/**
 * Splits `total` into `parts` whole numbers that differ by at most 1,
 * giving the extra units to the earliest entries.
 */
function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const extra = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Sets `values[editedIndex]` to `newValue` and spreads the remainder evenly across
 * the other rows so the total stays 100. The edit is clamped so every other row
 * keeps at least 1%. Returns null when `newValue` is not a whole number >= 1.
 */
export function rebalanceAfterEdit(values: number[], editedIndex: number, newValue: number): number[] | null {
  if (!Number.isInteger(newValue) || newValue < 1) return null;
  if (editedIndex < 0 || editedIndex >= values.length) return null;

  const others = values.length - 1;
  if (others === 0) return [100];
  const edited = Math.min(newValue, 100 - others);
  const shares = splitEvenly(100 - edited, others);

  let next = 0;
  return values.map((_, i) => (i === editedIndex ? edited : shares[next++]));
}

/**
 * Appends a row that takes an equal share (100 / n) and shrinks the existing rows
 * proportionally (largest remainder) so the total stays 100.
 */
export function addRowKeepingTotal(values: number[]): number[] {
  const count = values.length + 1;
  const newShare = Math.floor(100 / count);
  const budget = 100 - newShare;
  const sum = values.reduce((a, b) => a + b, 0);

  if (values.length === 0) return [100];
  if (sum <= 0) return [...splitEvenly(budget, values.length), newShare];

  const exact = values.map((v) => (v * budget) / sum);
  const floors = exact.map((v) => Math.max(1, Math.floor(v)));
  let missing = budget - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .map((o) => o.i);
  for (let k = 0; missing > 0; k = (k + 1) % order.length, missing--) floors[order[k]]++;
  for (let k = 0; missing < 0; k = (k + 1) % order.length) {
    const idx = order[order.length - 1 - k];
    if (floors[idx] > 1) {
      floors[idx]--;
      missing++;
    }
  }
  return [...floors, newShare];
}
