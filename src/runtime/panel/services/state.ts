import type { Anchor, ScreenItem, ScreenState } from '@common/types';
import { getState, setState } from '@panel/state/store';

type Patch = {
  added?: Array<{ anchor: ScreenItem['anchor']; label?: number }>;
  removedIds?: number[];
  updated?: Array<{ id: number; label?: number; anchor?: ScreenItem['anchor'] }>;
};

/**
 * Reassigns labels sequentially (1..n) according to the current array order.
 *
 * @param state - The state whose items should be relabeled in-place.
 * @remarks Also updates `nextLabel` to `items.length + 1`.
 */
function relabelSequential(state: ScreenState) {
  state.items.forEach((it, i) => (it.label = i + 1));
  state.nextLabel = state.items.length + 1;
}

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

  const hasRemoval = !!(patch.removedIds && patch.removedIds.length);

  if (patch.removedIds?.length) {
    const toRemove = new Set(patch.removedIds);
    state.items = state.items.filter((it) => !toRemove.has(it.id));
  }

  if (patch.updated?.length) {
    const map = new Map(state.items.map((i) => [i.id, i]));
    for (const u of patch.updated) {
      const it = map.get(u.id);
      if (!it) continue;
      if (typeof u.label === 'number') it.label = u.label;
      if (u.anchor) it.anchor = u.anchor;
    }
  }

  if (patch.added?.length) {
    for (const a of patch.added) {
      const id = state.nextId++;
      const label = typeof a.label === 'number' ? a.label : state.nextLabel++;
      const it: ScreenItem = {
        id,
        label,
        anchor: a.anchor,
        size: state.defaultSize,
        color: state.defaultColor,
        shape: state.defaultShape,
      };
      state.items.push(it);
    }
  }

  if (hasRemoval) relabelSequential(state);

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
