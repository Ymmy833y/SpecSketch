import { ScreenItem } from './types';

export function timestamp(d = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const tzo = -d.getTimezoneOffset();
  const sign = tzo >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(tzo) / 60));
  const mm = pad(Math.abs(tzo) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes(),
  )}-${pad(d.getSeconds())}${sign}${hh}${mm}`;
}

/**
 * Sorts items by preserving the **first-seen group order** from the input
 * and sorting **within each group by ascending `label`**.
 * When both group and label are equal, original order is preserved (stable).
 *
 * @param items - Array of {@link ScreenItem} to sort (not mutated).
 * @returns A new array sorted by group (first appearance) and then by label.
 */
export function sortScreenItemsByGroupAndLabel(items: ReadonlyArray<ScreenItem>): ScreenItem[] {
  // Attach original indices to preserve stable ordering for exact ties.
  const indexed = items.map((it, i) => ({ it, i }));

  // Record the first-seen order of each group (treats `undefined` as a valid group).
  const groupOrder = new Map<string | undefined, number>();
  let order = 0;
  for (const { it } of indexed) {
    const g = it.group; // allow undefined
    if (!groupOrder.has(g)) groupOrder.set(g, order++);
  }

  // Compare by: group first-seen order → label ascending → original index (stability).
  indexed.sort((a, b) => {
    const ga = groupOrder.get(a.it.group)!;
    const gb = groupOrder.get(b.it.group)!;
    if (ga !== gb) return ga - gb;

    if (a.it.label !== b.it.label) return a.it.label - b.it.label;

    // Tie-breaker to ensure stability for identical (group, label).
    return a.i - b.i;
  });

  return indexed.map((x) => x.it);
}
