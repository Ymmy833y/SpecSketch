import { type ScreenItem, ToastMessage } from '@common/types';
import type { Model } from '@panel/app/model';
import { update } from '@panel/app/update';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mock ----
vi.mock('@panel/services/state', () => {
  const fn = vi.fn((items: ScreenItem[]) => ({ items, nextLabel: 999 }));
  return { normalizeGroupLabelsAndCountUngrouped: fn };
});
import { normalizeGroupLabelsAndCountUngrouped } from '@panel/services/state';
import { Action, ActionType } from '@panel/types/action_types';
import { EffectType } from '@panel/types/effect_types';
import { STATUS } from '@panel/types/status';

// ---- Helpers ----
const norm = vi.mocked(normalizeGroupLabelsAndCountUngrouped);

function makeItem(
  id: number,
  group: string | undefined,
  label: number,
  extra?: Partial<Pick<ScreenItem, 'size' | 'color' | 'shape' | 'position'>>,
): ScreenItem {
  return {
    id,
    label,
    ...(group !== undefined ? { group } : {}),
    size: extra?.size ?? 12,
    color: extra?.color ?? 'Red',
    shape: extra?.shape ?? 'circle',
    position: extra?.position ?? 'left-top-outside',
  } as unknown as ScreenItem;
}

function baseModel(overrides?: Partial<Model>): Model {
  const m = {
    tabId: null,
    pageKey: '',
    status: STATUS.CONNECTED,
    items: [] as ScreenItem[],
    defaultSize: 12,
    defaultColor: 'Red',
    defaultShape: 'circle',
    defaultPosition: 'left-top-outside',
    defaultGroup: '',
    missingIds: [] as number[],
    selectionEnabled: false,
    selectItems: [] as number[],
    capture: {
      panelExpanded: false,
      format: 'png',
      area: 'full',
      quality: 80,
      scale: 1,
    },
  };
  return { ...(m as unknown as Model), ...(overrides as unknown as Model) };
}

// ---- Tests ----
describe('panel/app/update', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    norm.mockReset();
    norm.mockImplementation((items: ScreenItem[]) => items);
  });

  it('INIT: returns original model and no effects', () => {
    const model = baseModel();
    const action = { type: ActionType.INIT } as unknown as Action;

    const out = update(model, action);

    expect(out.model).toBe(model);
    expect(out.effects).toEqual([{ kind: EffectType.SET_THEME }]);
  });

  it('CONNECTED: sets tabId and pageKey', () => {
    const model = baseModel();
    const action = { type: ActionType.CONNECTED, tabId: 7, pageKey: 'p#1' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.tabId).toBe(7);
    expect(out.model.pageKey).toBe('p#1');
    expect(out.effects).toEqual([]);
  });

  it('SET_STATUS: updates status only', () => {
    const model = baseModel({ status: 'IDLE' as unknown as Model['status'] });
    const action = { type: ActionType.SET_STATUS, status: 'CONNECTED' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.status).toBe('CONNECTED');
    expect(out.effects).toEqual([]);
  });

  it('RESTORE_STATE: restores items/defaults/nextLabel and renders', () => {
    const items = [makeItem(1, '', 1)];
    const model = baseModel();
    const action = {
      type: ActionType.RESTORE_STATE,
      state: {
        items,
        defaultSize: 20,
        defaultColor: 'Blue',
        defaultShape: 'square',
        defaultPosition: 'right-top-outside',
        defaultGroup: 'test',
      },
    } as unknown as Action;

    const out = update(model, action);

    expect(out.model.items).toEqual(items);
    expect(out.model.defaultSize).toBe(20);
    expect(out.model.defaultColor).toBe('Blue');
    expect(out.model.defaultShape).toBe('square');
    expect(out.model.defaultPosition).toBe('right-top-outside');
    expect(out.model.defaultGroup).toBe('test');
    expect(out.effects).toEqual([{ kind: EffectType.RENDER_CONTENT, items }]);
  });

  it('RESTORE_STATE: restores defaultLabelFormat/defaultVisible and renders', () => {
    const items = [makeItem(1, '', 1)];
    const model = baseModel();
    const action = {
      type: ActionType.RESTORE_STATE,
      state: {
        items,
        defaultSize: 16,
        defaultColor: 'Green',
        defaultShape: 'square',
        defaultLabelFormat: 'LowerAlpha',
        defaultVisible: false,
        defaultPosition: 'right-bottom-outside',
        defaultGroup: 'grp',
      },
    } as unknown as Action;

    const out = update(model, action);

    expect(out.model.items).toEqual(items);
    expect(out.model.defaultSize).toBe(16);
    expect(out.model.defaultColor).toBe('Green');
    expect(out.model.defaultShape).toBe('square');
    expect(out.model.defaultLabelFormat).toBe('LowerAlpha');
    expect(out.model.defaultVisible).toBe(false);
    expect(out.model.defaultPosition).toBe('right-bottom-outside');
    expect(out.model.defaultGroup).toBe('grp');
    expect(out.effects).toEqual([{ kind: EffectType.RENDER_CONTENT, items }]);
  });

  it('SET_MISSING_IDS: updates missingIds only', () => {
    const model = baseModel();
    const action = { type: ActionType.SET_MISSING_IDS, missingIds: [2, 4] } as unknown as Action;

    const out = update(model, action);

    expect(out.model.missingIds).toEqual([2, 4]);
    expect(out.effects).toEqual([]);
  });

  it('TOGGLE_SELECT: toggles selectionEnabled and emits content toggle', () => {
    const model = baseModel({ selectionEnabled: false });
    const action = { type: ActionType.TOGGLE_SELECT } as unknown as Action;

    const out = update(model, action);

    expect(out.model.selectionEnabled).toBe(true);
    expect(out.effects).toEqual([{ kind: EffectType.TOGGLE_SELECT_ON_CONTENT, enabled: true }]);
  });

  it('CLEAR_ALL: clears items and nextLabel, emits CLEAR effects', () => {
    const model = baseModel({ items: [makeItem(1, '', 1)] });
    const action = { type: ActionType.CLEAR_ALL } as unknown as Action;

    const out = update(model, action);

    expect(out.model.items).toEqual([]);
    expect(out.effects).toEqual([
      { kind: EffectType.CLEAR_CONTENT },
      { kind: EffectType.CLEAR_STATE },
    ]);
  });

  it('CONTENT_SELECTED: no changes', () => {
    const model = baseModel();
    const action = { type: ActionType.CONTENT_SELECTED } as unknown as Action;

    const out = update(model, action);

    expect(out.model).toBe(model);
    expect(out.effects).toEqual([]);
  });

  it('TOGGLE_CAPTURE_PANEL: toggles panelExpanded', () => {
    const model = baseModel({ capture: { ...baseModel().capture, panelExpanded: false } });
    const action = { type: ActionType.TOGGLE_CAPTURE_PANEL } as unknown as Action;

    const out = update(model, action);

    expect(out.model.capture.panelExpanded).toBe(true);
    expect(out.effects).toEqual([]);
  });

  it('SET_BADGE_SIZE: updates only selected items and persists+renders', () => {
    const items = [makeItem(1, '', 1, { size: 12 }), makeItem(2, '', 2, { size: 12 })];
    const model = baseModel({ items, selectItems: [2] });
    const action = { type: ActionType.SET_BADGE_SIZE, size: 18 } as unknown as Action;

    const out = update(model, action);

    expect(out.model.defaultSize).toBe(18);
    expect(out.model.items.find((i) => i.id === 1)?.size).toBe(12);
    expect(out.model.items.find((i) => i.id === 2)?.size).toBe(18);
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('SET_BADGE_COLOR: updates only selected items and persists+renders', () => {
    const items = [makeItem(1, '', 1, { color: 'Red' }), makeItem(2, '', 2, { color: 'Red' })];
    const model = baseModel({ items, selectItems: [1] });
    const action = { type: ActionType.SET_BADGE_COLOR, color: 'Green' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.defaultColor).toBe('Green');
    expect(out.model.items.find((i) => i.id === 1)?.color).toBe('Green');
    expect(out.model.items.find((i) => i.id === 2)?.color).toBe('Red');
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('SET_BADGE_SHAPE: updates only selected items and persists+renders', () => {
    const items = [
      makeItem(1, '', 1, { shape: 'circle' }),
      makeItem(2, '', 2, { shape: 'circle' }),
    ];
    const model = baseModel({ items, selectItems: [2] });
    const action = { type: ActionType.SET_BADGE_SHAPE, shape: 'square' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.defaultShape).toBe('square');
    expect(out.model.items.find((i) => i.id === 1)?.shape).toBe('circle');
    expect(out.model.items.find((i) => i.id === 2)?.shape).toBe('square');
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('BADGE_DELETE: removes selected items then normalizes and persists+renders', () => {
    const items = [makeItem(1, '', 1), makeItem(2, '', 2), makeItem(3, '', 3)];
    const model = baseModel({ items, selectItems: [2, 3] });
    const action = { type: ActionType.BADGE_DELETE } as unknown as Action;

    const out = update(model, action);

    expect(norm).toHaveBeenCalled();
    const [[calledWith]] = norm.mock.calls as [[ScreenItem[]], ...unknown[]];
    expect(calledWith.map((i) => i.id)).toEqual([1]);

    expect(out.model.items.map((i) => i.id)).toEqual([1]);
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('SET_CAPTURE_*: updates capture fields only', () => {
    const model = baseModel();
    const A1 = update(model, {
      type: ActionType.SET_CAPTURE_FORMAT,
      format: 'jpeg',
    } as unknown as Action);
    const A2 = update(A1.model, {
      type: ActionType.SET_CAPTURE_AREA,
      area: 'FULL',
    } as unknown as Action);
    const A3 = update(A2.model, {
      type: ActionType.SET_CAPTURE_QUALITY,
      quality: 80,
    } as unknown as Action);
    const A4 = update(A3.model, {
      type: ActionType.SET_CAPTURE_SCALE,
      scale: 2,
    } as unknown as Action);

    expect(A4.model.capture).toEqual({
      panelExpanded: false,
      format: 'jpeg',
      area: 'FULL',
      quality: 80,
      scale: 2,
    });
    expect(A4.effects).toEqual([]);
  });

  it('CAPTURE_REQUESTED: without tabId emits NOTIFY_ERROR', () => {
    const model = baseModel({ tabId: null });
    const out = update(model, { type: ActionType.CAPTURE_REQUESTED } as unknown as Action);

    expect(out.effects).toEqual([{ kind: EffectType.NOTIFY_ERROR, error: 'No tabId' }]);
  });

  it('CAPTURE_REQUESTED: with tabId emits CAPTURE effect with payload', () => {
    const model = baseModel({
      tabId: 10,
      capture: { panelExpanded: false, format: 'png', area: 'full', quality: 90, scale: 2 },
    });
    const out = update(model, { type: ActionType.CAPTURE_REQUESTED } as unknown as Action);

    expect(out.effects).toEqual([
      {
        kind: EffectType.CAPTURE,
        payload: { tabId: 10, format: 'png', area: 'full', quality: 90, scale: 2 },
      },
    ]);
  });

  it('CAPTURE_FAILED: emits NOTIFY_ERROR(error)', () => {
    const model = baseModel();
    const out = update(model, {
      type: ActionType.CAPTURE_FAILED,
      error: 'boom',
    } as unknown as Action);

    expect(out.effects).toEqual([{ kind: EffectType.NOTIFY_ERROR, error: 'boom' }]);
  });

  it('REORDER_ITEMS: normal path calls normalizer with offset label (before -> +0.1)', () => {
    const items = [makeItem(1, 'G', 1), makeItem(2, 'G', 2), makeItem(3, 'G', 3)];
    const model = baseModel({ items });
    const action = {
      type: ActionType.REORDER_ITEMS,
      fromId: 3,
      fromIndex: 2,
      toIndex: 0, // Move forward => 0 + 0.1
    } as unknown as Action;

    const out = update(model, action);

    expect(norm).toHaveBeenCalled();
    const [[calledWith]] = norm.mock.calls as [[ScreenItem[]], ...unknown[]];
    const moved = calledWith.find((i) => i.id === 3)!;
    expect(moved.label).toBeCloseTo(0.1, 6);
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('REORDER_ITEMS: normal path calls normalizer with offset label (after -> +1.1)', () => {
    const items = [makeItem(1, 'G', 1), makeItem(2, 'G', 2), makeItem(3, 'G', 3)];
    const model = baseModel({ items });
    const action = {
      type: ActionType.REORDER_ITEMS,
      fromId: 1,
      fromIndex: 0,
      toIndex: 2, // Backward => 2 + 1.1
    } as unknown as Action;

    update(model, action);

    expect(norm).toHaveBeenCalled();
    const [[calledWith]] = norm.mock.calls as [[ScreenItem[]], ...unknown[]];
    const moved = calledWith.find((i) => i.id === 1)!;
    expect(moved.label).toBeCloseTo(3.1, 6);
  });

  it('REORDER_ITEMS: throws RangeError when toIndex is out of items range', () => {
    const items = [makeItem(1, 'G', 1)];
    const model = baseModel({ items });
    const action = {
      type: ActionType.REORDER_ITEMS,
      fromId: 1,
      fromIndex: 0,
      toIndex: 5,
    } as unknown as Action;

    expect(() => update(model, action)).toThrow(RangeError);
  });

  it('REORDER_ITEMS: throws Error when fromId not found', () => {
    const items = [makeItem(1, 'G', 1)];
    const model = baseModel({ items });
    const action = {
      type: ActionType.REORDER_ITEMS,
      fromId: 99,
      fromIndex: 0,
      toIndex: 0,
    } as unknown as Action;

    expect(() => update(model, action)).toThrow(Error);
  });

  it('REORDER_ITEMS: throws RangeError when toIndex exceeds group length', () => {
    // G1 has only one item. toIndex=2 is OK in terms of items.length(3),
    // but it exceeds the group length (1), so an error occurs.
    const items = [makeItem(1, 'G1', 1), makeItem(2, 'G2', 1), makeItem(3, 'G2', 2)];
    const model = baseModel({ items });
    const action = {
      type: ActionType.REORDER_ITEMS,
      fromId: 1,
      fromIndex: 0,
      toIndex: 2,
    } as unknown as Action;

    expect(() => update(model, action)).toThrow(RangeError);
  });

  it('ITEM_SELECTION_CHANGED by id: add and remove', () => {
    const model0 = baseModel({ selectItems: [] });
    const added = update(model0, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      id: 10,
      isCheck: true,
    } as unknown as Action);
    expect(added.model.selectItems).toEqual([10]);

    const removed = update(added.model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      id: 10,
      isCheck: false,
    } as unknown as Action);
    expect(removed.model.selectItems).toEqual([]);
  });

  it('ITEM_SELECTION_CHANGED by group: add trimmed group and remove', () => {
    const items = [makeItem(1, 'G1', 1), makeItem(2, '  G1', 2), makeItem(3, '', 3)];
    const model = baseModel({ items, selectItems: [] });

    const added = update(model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      group: '  G1 ',
      isCheck: true,
    } as unknown as Action);
    expect(new Set(added.model.selectItems)).toEqual(new Set([1, 2]));

    const removed = update(added.model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      group: 'G1',
      isCheck: false,
    } as unknown as Action);
    expect(removed.model.selectItems).toEqual([]);
  });

  it('ITEM_SELECTION_CHANGED all: select all then clear', () => {
    const items = [makeItem(1, 'A', 1), makeItem(2, 'B', 2)];
    const model = baseModel({ items });

    const all = update(model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      allCheck: true,
    } as unknown as Action);
    expect(new Set(all.model.selectItems)).toEqual(new Set([1, 2]));

    const none = update(all.model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      allCheck: false,
    } as unknown as Action);
    expect(none.model.selectItems).toEqual([]);
  });

  it('ITEM_HOVER_IN/OUT: emits HOVER effects', () => {
    const model = baseModel();
    const inFx = update(model, { type: ActionType.ITEM_HOVER_IN, id: 42 } as unknown as Action);
    expect(inFx.effects).toEqual([{ kind: EffectType.HOVER, id: 42 }]);

    const outFx = update(model, { type: ActionType.ITEM_HOVER_OUT } as unknown as Action);
    expect(outFx.effects).toEqual([{ kind: EffectType.HOVER, id: null }]);
  });

  it('UPDATE_ITEM_COMMENT: updates only target item comment and persists+renders', () => {
    const items = [makeItem(1, 'G', 1), makeItem(2, 'G', 2)];
    const model = baseModel({ items });

    const out = update(model, {
      type: ActionType.UPDATE_ITEM_COMMENT,
      id: 2,
      comment: 'hello world',
    } as unknown as Action);

    // Only the comment of the changed item is updated.
    expect(out.model.items.find((i) => i.id === 2)?.comment).toBe('hello world');
    expect(out.model.items.find((i) => i.id === 1)?.comment).toBeUndefined();

    // Other properties remain unchanged (e.g. label)
    expect(out.model.items.map((i) => i.label)).toEqual([1, 2]);

    // The effect is PERSIST_STATE and RENDER_CONTENT
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('UPDATE_ITEM_COMMENT: non-existing id leaves items structurally unchanged but still persists+renders', () => {
    const items = [makeItem(1, 'G', 1), makeItem(2, 'G', 2)];
    const model = baseModel({ items });

    const out = update(model, {
      type: ActionType.UPDATE_ITEM_COMMENT,
      id: 999,
      comment: 'ignored',
    } as unknown as Action);

    expect(out.model.items).toEqual(items);

    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('UPDATE_ITEM_COMMENT: empty string clears existing comment', () => {
    const items = [
      { ...makeItem(1, 'G', 1), comment: 'keep me' } as unknown as ScreenItem,
      { ...makeItem(2, 'G', 2), comment: 'to be cleared' } as unknown as ScreenItem,
    ];
    const model = baseModel({ items });

    const out = update(model, {
      type: ActionType.UPDATE_ITEM_COMMENT,
      id: 2,
      comment: '',
    } as unknown as Action);

    // The comment with id=2 is cleared to an empty string.
    expect(out.model.items.find((i) => i.id === 2)?.comment).toBe('');

    // id=1 remains unchanged
    expect(out.model.items.find((i) => i.id === 1)?.comment).toBe('keep me');

    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('PORT_DISCONNECTED: sets status, disables selection, and toggles off on content', () => {
    const model = baseModel({
      selectionEnabled: true,
      status: 'CONNECTED' as unknown as Model['status'],
    });
    const out = update(model, { type: ActionType.PORT_DISCONNECTED } as unknown as Action);

    expect(out.model.status).toBe('DISCONNECTED');
    expect(out.model.selectionEnabled).toBe(false);
    expect(out.effects).toEqual([{ kind: EffectType.TOGGLE_SELECT_ON_CONTENT, enabled: false }]);
  });

  it('default: unknown action type yields no change', () => {
    const model = baseModel({ items: [makeItem(1, '', 1)] });
    const action = { type: -1 } as unknown as Action;

    const out = update(model, action);

    expect(out.model).toBe(model);
    expect(out.effects).toEqual([]);
  });

  it('SET_BADGE_POSITION: updates only selected items and persists+renders', () => {
    const items = [
      makeItem(1, '', 1, { position: 'left-top-outside' }),
      makeItem(2, '', 2, { position: 'right-top-outside' }),
    ];
    const model = baseModel({ items, selectItems: [2] });

    const action = {
      type: ActionType.SET_BADGE_POSITION,
      position: 'top-outside',
    } as unknown as Action;

    const out = update(model, action);

    expect(out.model.defaultPosition).toBe('top-outside');
    expect(out.model.items.find((i) => i.id === 1)?.position).toBe('left-top-outside');
    expect(out.model.items.find((i) => i.id === 2)?.position).toBe('top-outside');

    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('SET_STATUS: when status becomes non-CONNECTED, items are cleared', () => {
    const model = baseModel({
      status: 'CONNECTED' as unknown as Model['status'],
      items: [makeItem(1, 'G', 1)],
    });
    const action = { type: ActionType.SET_STATUS, status: 'DISCONNECTED' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.status).toBe('DISCONNECTED');
    expect(out.model.items).toEqual([]);
    expect(out.effects).toEqual([]);
  });

  it('SET_GROUP: updates selected items group, defers relabel with large numbers, then persists+renders', () => {
    // Targets are id:1 and id:2.
    // Because processing occurs after sorting (first-seen group → ascending label),
    // reassignment runs in the order label=1 (id=1) → label=2 (id=2) within group A.
    // Therefore, id=1 receives the larger temporary label (MAX_SAFE_INTEGER).
    const items = [makeItem(1, 'A', 1), makeItem(2, 'A', 2), makeItem(3, 'B', 1)];
    const model = baseModel({ items, selectItems: [1, 2] });
    const action = { type: ActionType.SET_GROUP, group: 'B' } as unknown as Action;

    const out = update(model, action);

    expect(norm).toHaveBeenCalled();
    // The default group will contain the passed value.
    expect(out.model.defaultGroup).toBe('B');

    const after = out.model.items;
    const s1 = after.find((i) => i.id === 1)!;
    const s2 = after.find((i) => i.id === 2)!;
    const other = after.find((i) => i.id === 3)!;

    expect(s1.group).toBe('B');
    expect(s2.group).toBe('B');
    expect(other.group).toBe('B');

    // The label is overwritten with very large temporary values before normalization.
    const THRESHOLD = 1e12;
    expect(s1.label).toBeGreaterThan(THRESHOLD);
    expect(s2.label).toBeGreaterThan(THRESHOLD);

    // New rule: processed in group/label order -> id=1 is processed before id=2,
    // so s1.label (MAX_SAFE_INTEGER) > s2.label (MAX_SAFE_INTEGER - 1).
    expect(s1.label).toBeGreaterThan(s2.label);

    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('ITEM_SELECTION_CHANGED by group: UNGROUPED_VALUE selects and unselects items with undefined group', () => {
    const items = [makeItem(1, undefined, 1), makeItem(2, 'X', 2)];
    const model = baseModel({ items, selectItems: [] });

    // Undefined is selected by specifying UNGROUPED_VALUE
    const added = update(model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      group: '',
      isCheck: true,
    } as unknown as Action);
    expect(new Set(added.model.selectItems)).toEqual(new Set([1]));

    const removed = update(added.model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      group: '',
      isCheck: false,
    } as unknown as Action);
    expect(removed.model.selectItems).toEqual([]);
  });

  it('ITEM_SELECTION_CHANGED by group: non-existing group leaves selection unchanged', () => {
    const items = [makeItem(1, 'A', 1), makeItem(2, 'B', 2)];
    const model = baseModel({ items, selectItems: [2] });

    const out = update(model, {
      type: ActionType.ITEM_SELECTION_CHANGED,
      group: 'NO_SUCH_GROUP',
      isCheck: true,
    } as unknown as Action);

    expect(out.model.selectItems).toEqual([2]);
    expect(out.effects).toEqual([]);
  });

  it('CAPTURE_SUCCEEDED: no changes and no effects', () => {
    const model = baseModel();
    const out = update(model, { type: ActionType.CAPTURE_SUCCEEDED } as unknown as Action);

    expect(out.model).toBe(model);
    expect(out.effects).toEqual([]);
  });

  it('SET_THEME: updates theme only (no effects)', () => {
    const model = baseModel({ theme: 'light' as unknown as Model['theme'] });
    const action = { type: ActionType.SET_THEME, theme: 'dark' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.theme).toBe('dark');
    expect(out.effects).toEqual([]);
  });

  it('UPDATE_THEME: updates theme and emits UPDATE_THEME effect', () => {
    const model = baseModel({ theme: 'light' as unknown as Model['theme'] });
    const action = { type: ActionType.UPDATE_THEME, theme: 'dark' } as unknown as Action;

    const out = update(model, action);

    expect(out.model.theme).toBe('dark');
    expect(out.effects).toEqual([{ kind: EffectType.UPDATE_THEME, theme: 'dark' }]);
  });
  it('STORE_RELOAD_REQUESTED: emits READ_SCREEN_STATE_STORE effect (no model change)', () => {
    const model = baseModel();
    const action = { type: ActionType.STORE_RELOAD_REQUESTED } as unknown as Action;

    const out = update(model, action);

    expect(out.model).toBe(model);
    expect(out.effects).toEqual([{ kind: EffectType.READ_SCREEN_STATE_STORE }]);
  });

  it('STORE_RELOAD_SUCCEEDED: updates pageKeys only (no effects)', () => {
    const model = baseModel();
    const pageKeys = ['https://example.com/a', 'https://example.com/b'];
    const action = {
      type: ActionType.STORE_RELOAD_SUCCEEDED,
      pageKeys,
    } as unknown as Action;

    const out = update(model, action);

    // pageKeys is updated
    expect(out.model).toMatchObject({ pageKeys });
    // no side effects
    expect(out.effects).toEqual([]);
    // other fields remain as-is (spot-check)
    expect(out.model.items).toBe(model.items);
    expect(out.model.tabId).toBe(model.tabId);
  });

  it('REMOVE_SCREEN_STATE_BY_PAGE: emits REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY with given pageKey', () => {
    const model = baseModel();
    const action = {
      type: ActionType.REMOVE_SCREEN_STATE_BY_PAGE,
      pageKey: 'https://example.com/remove-me',
    } as unknown as Action;

    const out = update(model, action);

    expect(out.model).toBe(model);
    expect(out.effects).toEqual([
      {
        kind: EffectType.REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY,
        pageKey: 'https://example.com/remove-me',
      },
    ]);
  });

  it('EXPORT_SCREEN_STATE_BY_PAGE: emits EXPORT_SCREEN_STATE_BY_PAGE_KEY with given pageKey', () => {
    const model = baseModel();
    const action = {
      type: ActionType.EXPORT_SCREEN_STATE_BY_PAGE,
      pageKey: 'https://example.com/export-me',
    } as unknown as Action;

    const out = update(model, action);

    // Model is unchanged
    expect(out.model).toBe(model);
    // Emit export effect with the same pageKey
    expect(out.effects).toEqual([
      {
        kind: EffectType.EXPORT_SCREEN_STATE_BY_PAGE_KEY,
        pageKey: 'https://example.com/export-me',
      },
    ]);
  });

  it('EXPORT_FAILED: emits NOTIFY_ERROR(error)', () => {
    const model = baseModel();
    const action = {
      type: ActionType.EXPORT_FAILED,
      error: 'failed to export',
    } as unknown as Action;

    const out = update(model, action);

    // Notify error effect with the given message
    expect(out.effects).toEqual([{ kind: EffectType.NOTIFY_ERROR, error: 'failed to export' }]);
    // Model remains unchanged
    expect(out.model).toBe(model);
  });

  it('IMPORT_SCREAN_STATE_FILE: emits IMPORT_SCREAN_STATE_FILE effect with given file (no model change)', () => {
    const model = baseModel();
    // Use a simple stub object as a File-like placeholder for identity check
    const fileStub = {} as unknown as File;

    const action = {
      type: ActionType.IMPORT_SCREAN_STATE_FILE,
      file: fileStub,
    } as unknown as Action;

    const out = update(model, action);

    // Model is unchanged
    expect(out.model).toBe(model);
    // Effect includes the same file object
    expect(out.effects).toEqual([{ kind: EffectType.IMPORT_SCREAN_STATE_FILE, file: fileStub }]);
  });

  it('IMPORT_FAILED: stores toastMessages on model (no effects)', () => {
    const model = baseModel({ toastMessages: [] as ToastMessage[] });
    const toastMessages = [
      { uuid: 'u-1', message: 'Invalid file format', kind: 'error' },
      { uuid: 'u-2', message: 'Nothing to import', kind: 'info' },
    ] as unknown as Model['toastMessages'];

    const action = {
      type: ActionType.IMPORT_FAILED,
      toastMessages,
    } as unknown as Action;

    const out = update(model, action);

    // toastMessages is replaced with the provided array
    expect(out.model.toastMessages).toEqual(toastMessages);
    // No side effects
    expect(out.effects).toEqual([]);
  });

  it('TOAST_DISMISS_REQUESTED: removes a toast by uuid (no effects)', () => {
    const model = baseModel({
      toastMessages: [
        { uuid: 'keep-me', message: 'ok', kind: 'success' },
        { uuid: 'remove-me', message: 'error', kind: 'error' },
      ] as unknown as Model['toastMessages'],
    });

    const action = {
      type: ActionType.TOAST_DISMISS_REQUESTED,
      uuid: 'remove-me',
    } as unknown as Action;

    const out = update(model, action);

    // The toast with matching uuid is removed
    expect(out.model.toastMessages?.map((t: ToastMessage) => t.uuid)).toEqual(['keep-me']);
    // No side effects
    expect(out.effects).toEqual([]);
  });

  it('SET_BADGE_LABEL_FORMAT: updates only selected items and persists+renders', () => {
    // Two items; only id=2 is selected.
    const items = [
      makeItem(1, '', 1 /* labelFormat intentionally omitted */),
      makeItem(2, '', 2 /* labelFormat intentionally omitted */),
    ];
    const model = baseModel({ items, selectItems: [2] });

    const action = {
      type: ActionType.SET_BADGE_LABEL_FORMAT,
      labelFormat: 'UpperAlpha',
    } as unknown as Action;

    const out = update(model, action);

    // Default label format is updated on the model
    expect(out.model.defaultLabelFormat).toBe('UpperAlpha');

    // Only the selected item receives the new labelFormat
    expect(out.model.items.find((i) => i.id === 1)?.labelFormat).toBeUndefined();
    expect(out.model.items.find((i) => i.id === 2)?.labelFormat).toBe('UpperAlpha');

    // Effects: persist state and render content with updated items
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('SET_BADGE_VISIBLE: updates only selected items and persists+renders', () => {
    // id=1 remains true, id=2 will be updated to false (selected)
    const items = [
      { ...(makeItem(1, '', 1) as unknown as ScreenItem), visible: true } as unknown as ScreenItem,
      { ...(makeItem(2, '', 2) as unknown as ScreenItem), visible: true } as unknown as ScreenItem,
    ];
    const model = baseModel({ items, selectItems: [2] });

    const action = { type: ActionType.SET_BADGE_VISIBLE, visible: false } as unknown as Action;

    const out = update(model, action);

    // Default visible flag on model is updated
    expect(out.model.defaultVisible).toBe(false);

    // Only selected item (id=2) is updated
    expect(out.model.items.find((i) => i.id === 1)?.visible).toBe(true);
    expect(out.model.items.find((i) => i.id === 2)?.visible).toBe(false);

    // Effects: persist state and render with updated items
    expect(out.effects[0]).toEqual({ kind: EffectType.PERSIST_STATE });
    expect(out.effects[1]).toEqual({ kind: EffectType.RENDER_CONTENT, items: out.model.items });
  });

  it('IMPORT_SUCCEEDED: stores toastMessages on model (no effects)', () => {
    const model = baseModel({ toastMessages: [] as ToastMessage[] });
    const toastMessages = [
      { uuid: 'u-1', message: 'Import completed successfully', kind: 'success' },
      { uuid: 'u-2', message: 'Added 3 items', kind: 'info' },
    ] as unknown as Model['toastMessages'];

    const action = {
      type: ActionType.IMPORT_SUCCEEDED,
      toastMessages,
    } as unknown as Action;

    const out = update(model, action);

    // toastMessages is replaced with the provided array
    expect(out.model.toastMessages).toEqual(toastMessages);
    // No side effects
    expect(out.effects).toEqual([]);
  });
});
