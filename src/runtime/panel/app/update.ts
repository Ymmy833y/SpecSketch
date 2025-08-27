import type { ScreenItem } from '@common/types';
import { normalizeGroupLabelsAndCountUngrouped } from '@panel/services/state';
import { STATUS } from '@panel/view/status';

import { Action, ActionType } from '../types/action_types';
import { Effect, EffectType } from '../types/effect_types';

import type { Model } from './model';

const NOGROUP = '' as const;

export function update(model: Model, action: Action): { model: Model; effects: Effect[] } {
  switch (action.type) {
    case ActionType.INIT:
      return { model, effects: [] };

    case ActionType.CONNECTED:
      return { model: { ...model, tabId: action.tabId, pageKey: action.pageKey }, effects: [] };

    case ActionType.SET_STATUS: {
      if (action.status === STATUS.CONNECTED) {
        return { model: { ...model, status: action.status }, effects: [] };
      }
      return { model: { ...model, items: [], nextLabel: 1, status: action.status }, effects: [] };
    }

    case ActionType.RESTORE_STATE:
      return {
        model: {
          ...model,
          items: action.state.items,
          nextLabel: action.state.nextLabel,
          defaultSize: action.state.defaultSize,
          defaultColor: action.state.defaultColor,
          defaultShape: action.state.defaultShape,
        },
        effects: [{ kind: EffectType.RENDER_CONTENT, items: action.state.items }],
      };

    case ActionType.SET_MISSING_IDS:
      return {
        model: { ...model, missingIds: action.missingIds },
        effects: [],
      };

    case ActionType.TOGGLE_SELECT: {
      const next = !model.selectionEnabled;
      return {
        model: { ...model, selectionEnabled: next },
        effects: [{ kind: EffectType.TOGGLE_SELECT_ON_CONTENT, enabled: next }],
      };
    }

    case ActionType.CLEAR_ALL:
      return {
        model: { ...model, items: [], nextLabel: 1 },
        effects: [{ kind: EffectType.CLEAR_CONTENT }, { kind: EffectType.CLEAR_STATE }],
      };

    case ActionType.CONTENT_SELECTED:
      return { model, effects: [] };

    case ActionType.TOGGLE_CAPTURE_PANEL:
      return {
        model: {
          ...model,
          capture: { ...model.capture, panelExpanded: !model.capture.panelExpanded },
        },
        effects: [],
      };

    case ActionType.SET_BADGE_SIZE: {
      const items = model.items.map((it) => ({
        ...it,
        ...(model.selectItems.includes(it.id) ? { size: action.size } : {}),
      }));
      return {
        model: { ...model, defaultSize: action.size, items },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.SET_BADGE_COLOR: {
      const items = model.items.map((it) => ({
        ...it,
        ...(model.selectItems.includes(it.id) ? { color: action.color } : {}),
      }));

      return {
        model: { ...model, defaultColor: action.color, items },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.SET_BADGE_SHAPE: {
      const items = model.items.map((it) => ({
        ...it,
        ...(model.selectItems.includes(it.id) ? { shape: action.shape } : {}),
      }));
      return {
        model: { ...model, defaultShape: action.shape, items },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.BADGE_DELETE: {
      const itemsMarkedForRelabel = model.items.filter((it) => !model.selectItems.includes(it.id));
      const { items, nextLabel } = normalizeGroupLabelsAndCountUngrouped(itemsMarkedForRelabel);
      return {
        model: { ...model, items, nextLabel },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.SET_CAPTURE_FORMAT:
      return {
        model: { ...model, capture: { ...model.capture, format: action.format } },
        effects: [],
      };

    case ActionType.SET_CAPTURE_AREA:
      return { model: { ...model, capture: { ...model.capture, area: action.area } }, effects: [] };

    case ActionType.SET_CAPTURE_QUALITY:
      return {
        model: { ...model, capture: { ...model.capture, quality: action.quality } },
        effects: [],
      };

    case ActionType.SET_CAPTURE_SCALE:
      return {
        model: { ...model, capture: { ...model.capture, scale: action.scale } },
        effects: [],
      };

    case ActionType.CAPTURE_REQUESTED:
      if (model.tabId == null)
        return { model, effects: [{ kind: EffectType.NOTIFY_ERROR, error: 'No tabId' }] };
      return {
        model,
        effects: [
          {
            kind: EffectType.CAPTURE,
            payload: {
              tabId: model.tabId,
              format: model.capture.format,
              area: model.capture.area,
              quality: model.capture.quality,
              scale: model.capture.scale,
            },
          },
        ],
      };

    case ActionType.CAPTURE_SUCCEEDED:
      return { model, effects: [] };

    case ActionType.CAPTURE_FAILED:
      return { model, effects: [{ kind: EffectType.NOTIFY_ERROR, error: action.error }] };

    case ActionType.REORDER_ITEMS: {
      const itemsMarkedForRelabel = reorderItemLabel(
        model.items,
        action.fromId,
        action.fromIndex,
        action.toIndex,
      );
      const { items, nextLabel } = normalizeGroupLabelsAndCountUngrouped(itemsMarkedForRelabel);
      return {
        model: { ...model, items, nextLabel },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.SET_ITEM_GROUP: {
      const itemsMarkedForRelabel = updateGroupAndDeferRelabel(
        model.items,
        action.id,
        action.group,
      );
      const { items, nextLabel } = normalizeGroupLabelsAndCountUngrouped(itemsMarkedForRelabel);
      return {
        model: { ...model, items, nextLabel },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.ITEM_SELECTION_CHANGED: {
      if ('id' in action) {
        // Select/deselect a single item
        const selectItems = applyItemSelectionChangedById(
          action.id,
          action.isCheck,
          model.selectItems,
        );
        return {
          model: { ...model, selectItems },
          effects: [],
        };
      } else if ('group' in action) {
        // Select/deselect a group
        const selectItems = applyItemSelectionChangedForGroup(
          action.group,
          action.isCheck,
          model.selectItems,
          model.items,
        );
        return {
          model: { ...model, selectItems },
          effects: [],
        };
      } else {
        // Select all/Deselect all
        const selectItems = applyItemSelectionChangedForAll(action.allCheck, model.items);
        return {
          model: { ...model, selectItems },
          effects: [],
        };
      }
    }

    case ActionType.ITEM_HOVER_IN:
      return {
        model,
        effects: [{ kind: EffectType.HOVER, id: action.id }],
      };

    case ActionType.ITEM_HOVER_OUT:
      return {
        model,
        effects: [{ kind: EffectType.HOVER, id: null }],
      };

    case ActionType.PORT_DISCONNECTED:
      return {
        model: { ...model, status: STATUS.DISCONNECTED, selectionEnabled: false },
        effects: [{ kind: EffectType.TOGGLE_SELECT_ON_CONTENT, enabled: false }],
      };

    default:
      return { model, effects: [] };
  }
}

/**
 * Relabel items as if the item with `fromId` was moved to the position
 * whose label equals `items[toIndex].label`. Labels of the items in between
 * are shifted by ±1 to keep labels unique and contiguous (if they were).
 *
 * @param items   - Source items (not mutated).
 * @param fromId  - ID of the item to move.
 * @param fromIndex  - The current index of the item to be moved.
 * @param toIndex - Target index in `items` whose label becomes the new label.
 * @returns A new array with updated labels.
 * @throws RangeError if `toIndex` is out of bounds or Error if `fromId` not found.
 */
function reorderItemLabel(items: ScreenItem[], fromId: number, fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    throw new RangeError(`toIndex out of range: ${toIndex}`);
  }

  const fromIdx = items.findIndex((i) => i.id === fromId);
  if (fromIdx === -1) {
    throw new Error(`Item not found for id=${fromId}`);
  }
  if (toIndex < 0 || toIndex >= items.filter((it) => it.group === items[fromIdx]!.group).length) {
    throw new RangeError(`toIndex out of range: ${toIndex}`);
  }

  const OFFSET_AFTER = 1.1;
  const OFFSET_BEFORE = 0.1;

  const offset = fromIndex < toIndex ? OFFSET_AFTER : OFFSET_BEFORE;
  const label = toIndex + offset;

  return items.map((it) => (it.id === fromId ? { ...it, label } : it));
}

/**
 * Updates the group of a specific item and *defers* label normalization.
 *
 * Notes
 * - This function does **not** reorder or compact labels for any group.
 *   Call `relabelConsecutivePerGroup()` afterwards to normalize labels to 1..n per group.
 *
 * @param items - The current list of items.
 * @param id - The ID of the target item whose group is to be updated.
 * @param nextGroupRaw - The target group name. Empty string ("") represents "no group".
 * @returns A new array where only the target item is updated when the group changes; otherwise the original array.
 */
function updateGroupAndDeferRelabel(
  items: ScreenItem[],
  id: number,
  nextGroupRaw: string,
): ScreenItem[] {
  const normalize = (g?: string) => (g ?? '').trim();
  const nextGroup = normalize(nextGroupRaw);

  const idx = items.findIndex((it) => it.id === id);
  if (idx < 0) return items;

  const target = items[idx]!;
  const currGroup = normalize(target.group);

  // If the item already belongs to the target group, skip the operation.
  if (currGroup === nextGroup) {
    return items;
  }

  return items.map((it) => (it.id === id ? { ...it, group: nextGroup, label: Infinity } : it));
}

function applyItemSelectionChangedById(id: number, isCheck: boolean, selectItems: number[]) {
  if (isCheck) {
    if (!selectItems.includes(id)) {
      return [...selectItems, id];
    }
  }
  return selectItems.filter((item) => item !== id);
}

function applyItemSelectionChangedForGroup(
  group: string,
  isCheck: boolean,
  selectItems: number[],
  items: ScreenItem[],
) {
  const g = group.trim();
  const groupIds = items.filter((it) => (it.group ?? NOGROUP).trim() === g).map((it) => it.id);

  if (groupIds.length === 0) return selectItems;
  if (isCheck) {
    const set = new Set<number>(selectItems);
    for (const id of groupIds) set.add(id);
    return [...set];
  } else {
    const groupSet = new Set<number>(groupIds);
    return selectItems.filter((id) => !groupSet.has(id));
  }
}

function applyItemSelectionChangedForAll(allCheck: boolean, items: ScreenItem[]) {
  if (allCheck) {
    return items.map((it) => it.id);
  }
  return [];
}
