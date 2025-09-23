import type { Anchor, ScreenItem, ScreenState } from '@common/types';
import { getState, setState } from '@panel/state/store';

type Patch = {
  added?: Array<{ anchor: ScreenItem['anchor'] }>;
  removedIds?: number[];
};

/**
 * Applies a patch (add/update/remove) to the state for the given page key,
 * relabels sequentially if any removal occurred, persists the result,
 * and returns the updated state.
 *
 * @param pageKeyStr - Page key of the state to modify.
 * @param patch - Changes to apply to the state.
 * @returns Promise resolving to the updated ScreenState.
 */
export async function applyPatch(pageKey: string, patch: Patch): Promise<ScreenState> {
  const state = await getState(pageKey);

  if (patch.removedIds?.length) {
    const toRemove = new Set(patch.removedIds);
    state.items = state.items.filter((it) => !toRemove.has(it.id));
  }

  if (patch.added?.length) {
    for (const a of patch.added) {
      const id = state.nextId++;
      const label = Infinity;
      const it: ScreenItem = {
        id,
        label,
        anchor: a.anchor,
        size: state.defaultSize,
        color: state.defaultColor,
        shape: state.defaultShape,
        position: state.defaultPosition,
        group: state.defaultGroup,
      };
      state.items.push(it);
    }
  }
  state.items = normalizeGroupLabelsAndCountUngrouped(state.items);

  await setState(pageKey, state);
  return state;
}

/**
 * Toggles selection for the given anchors (from Content): if an anchor already
 * exists, remove it; otherwise add it. Dedupe incoming anchors by `value`,
 * apply the corresponding patch, persist, and return the latest state.
 *
 * @param pageKeyStr - Page key of the state to update.
 * @param anchors - Anchors reported by Content.
 * @returns Promise resolving to the updated ScreenState.
 */
export async function handleSelected(pageKey: string, anchors: Anchor[]): Promise<ScreenState> {
  const state = await getState(pageKey);
  const uniq = Array.from(new Set(anchors.map((a) => a.value)))
    .map((v) => anchors.find((a) => a.value === v)!)
    .filter(Boolean);

  const removedIds: number[] = [];
  const toAdd: NonNullable<Patch['added']> = [];

  for (const a of uniq) {
    const found = state.items.find(
      (it) => it.anchor.kind === a.kind && it.anchor.value === a.value,
    );
    if (found) {
      removedIds.push(found.id);
    } else {
      toAdd.push({ anchor: a });
    }
  }

  const patch: Patch = {};
  if (removedIds.length) patch.removedIds = removedIds;
  if (toAdd.length) patch.added = toAdd;

  return applyPatch(pageKey, patch);
}

/**
 * Relabels items consecutively (1..n) *within each group* and reports
 * the current size of the "no group" bucket.
 *
 * @param items - The original list of items (treated immutably).
 * @returns An object containing the normalized items and the no-group count.
 */
export function normalizeGroupLabelsAndCountUngrouped(items: ScreenItem[]): ScreenItem[] {
  const normalize = (g?: string) => (g ?? '').trim(); // '' is unified as UnGroup

  // Bucket [index, item] for each group
  const buckets = new Map<string, Array<{ index: number; item: ScreenItem }>>();
  items.forEach((item, index) => {
    const key = normalize(item.group);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push({ index, item });
  });

  const out = items.slice();

  // Sort each group → Reassign 1..n
  for (const [, bucket] of buckets) {
    bucket.sort((a, b) => {
      if (a.item.label !== b.item.label) return a.item.label - b.item.label;
      return a.item.id - b.item.id;
    });

    bucket.forEach(({ index, item }, i) => {
      const desired = i + 1;
      if (item.label !== desired) {
        out[index] = { ...item, label: desired };
      }
    });
  }
  return out;
}
