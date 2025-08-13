import type { Anchor, ScreenItem, ScreenState } from '@common/types';

const ROOT_KEY = 'screenStateByPage';
type StateMap = Record<string, ScreenState>;

async function readAll(): Promise<StateMap> {
  const raw = await chrome.storage.local.get(ROOT_KEY);
  return (raw[ROOT_KEY] as StateMap) ?? {};
}

async function writeAll(map: StateMap): Promise<void> {
  await chrome.storage.local.set({ [ROOT_KEY]: map });
}

export async function getState(pageKey: string): Promise<ScreenState> {
  const map = await readAll();
  return map[pageKey] ?? { items: [], nextId: 1, nextLabel: 1 };
}

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
 * Relabel (use the array order as-is)
 * @param state
 */
function relabelSequential(state: ScreenState) {
  state.items.forEach((it, i) => {
    it.label = i + 1;
  });
  state.nextLabel = state.items.length + 1;
}

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

/** Content からの SELECTED を受けて「トグル（追加/削除）」する */
export async function handleSelected(pageKeyStr: string, anchors: Anchor[]) {
  const state = await getState(pageKeyStr);
  // 重複入力の除去（value一致でユニーク化）
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
  if (removedIds.length) patch.removedIds = removedIds; // ← 削除ありなら後段でラベル振り直し
  if (toAdd.length) patch.added = toAdd;

  return applyPatch(pageKeyStr, patch);
}
