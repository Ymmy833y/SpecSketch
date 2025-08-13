import type { Anchor, ScreenItem, ScreenState } from '@common/types';

const ROOT_KEY = 'screenStateByPage';
type StateMap = Record<string, ScreenState>;

/**
 * Loads the entire state map from chrome.storage.local under ROOT_KEY.
 *
 * @returns Promise resolving to the full state map; returns an empty object when nothing is stored.
 * @remarks This performs storage I/O.
 */
async function readAll(): Promise<StateMap> {
  const raw = await chrome.storage.local.get(ROOT_KEY);
  return (raw[ROOT_KEY] as StateMap) ?? {};
}

/**
 * Persists the entire state map to chrome.storage.local under ROOT_KEY.
 *
 * @param map - The complete state map to write.
 * @returns Promise that resolves when the write completes.
 * @remarks This overwrites the stored map for ROOT_KEY.
 */
async function writeAll(map: StateMap): Promise<void> {
  await chrome.storage.local.set({ [ROOT_KEY]: map });
}

/**
 * Retrieves the state bound to a page key.
 * Returns the initial default when the key has no stored state.
 *
 * @param pageKey - Page key that identifies the page state bucket.
 * @returns Promise resolving to the corresponding ScreenState.
 */
export async function getState(pageKey: string): Promise<ScreenState> {
  const map = await readAll();
  return map[pageKey] ?? { items: [], nextId: 1, nextLabel: 1 };
}

/**
 * Stores the given state under the specified page key.
 *
 * @param pageKeyStr - Page key to associate with the state.
 * @param state - The ScreenState to persist.
 * @returns Promise that resolves when the write completes.
 */
export async function setState(pageKeyStr: string, state: ScreenState): Promise<void> {
  const map = await readAll();
  map[pageKeyStr] = state;
  await writeAll(map);
}

type Patch = {
  added?: Array<{ anchor: ScreenItem['anchor']; label?: number; meta?: ScreenItem['meta'] }>;
  removedIds?: number[];
  updated?: Array<{ id: number; label?: number; anchor?: ScreenItem['anchor']; meta?: ScreenItem['meta'] }>;
};

/**
 * Reassigns labels sequentially (1..n) according to the current array order.
 *
 * @param state - The state whose items should be relabeled in-place.
 * @remarks Also updates `nextLabel` to `items.length + 1`.
 */
function relabelSequential(state: ScreenState) {
  state.items.forEach((it, i) => {
    it.label = i + 1;
  });
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
export async function applyPatch(pageKeyStr: string, patch: Patch) {
  const state = await getState(pageKeyStr);

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
      if (u.meta) it.meta = u.meta;
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
        ...(a.meta ? { meta: a.meta } : {}),
      };
      state.items.push(it);
    }
  }

  // If at least one item is deleted, relabel from 1 to n in the current array order.
  if (hasRemoval) {
    relabelSequential(state);
  }

  await setState(pageKeyStr, state);
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
export async function handleSelected(pageKeyStr: string, anchors: Anchor[]) {
  const state = await getState(pageKeyStr);
  const uniq = Array.from(new Set(anchors.map((a) => a.value)))
    .map((v) => anchors.find((a) => a.value === v)!)
    .filter(Boolean);

  const removedIds: number[] = [];
  const toAdd: NonNullable<Patch['added']> = [];

  for (const a of uniq) {
    const found = state.items.find((it) => it.anchor.kind === a.kind && it.anchor.value === a.value);
    if (found) {
      removedIds.push(found.id);
    } else {
      toAdd.push({ anchor: a });
    }
  }

  const patch: Patch = {};
  if (removedIds.length) patch.removedIds = removedIds;
  if (toAdd.length) patch.added = toAdd;

  return applyPatch(pageKeyStr, patch);
}
