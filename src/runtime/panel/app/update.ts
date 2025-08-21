import type { ScreenItem } from '@common/types';

import { ActionType } from '../types/action_types';
import { EffectType } from '../types/effect_types';

import type { Action } from './actions';
import type { Model } from './model';

export type Effect =
  | { kind: EffectType.RENDER_CONTENT; items: ScreenItem[] }
  | { kind: EffectType.TOGGLE_SELECT_ON_CONTENT; enabled: boolean }
  | { kind: EffectType.CLEAR_CONTENT }
  | {
      kind: EffectType.CAPTURE;
      payload: {
        tabId: number;
        format: 'png' | 'jpeg';
        area: 'full' | 'viewport';
        quality: number;
        scale: number;
      };
    }
  | { kind: EffectType.CLEAR_STATE }
  | { kind: EffectType.PERSIST_STATE }
  | { kind: EffectType.CLOSE_PANEL_IF_MATCH; tabId?: number }
  | { kind: EffectType.NOTIFY_ERROR; error: unknown };

export function update(model: Model, action: Action): { model: Model; effects: Effect[] } {
  switch (action.type) {
    case ActionType.INIT:
      return { model, effects: [] };

    case ActionType.CONNECTED:
      return { model: { ...model, tabId: action.tabId, pageKey: action.pageKey }, effects: [] };

    case ActionType.SET_STATUS:
      return { model: { ...model, status: action.status }, effects: [] };

    case ActionType.RESTORE_STATE:
      return {
        model: {
          ...model,
          items: action.state.items,
          defaultSize: action.state.defaultSize,
          defaultColor: action.state.defaultColor,
          defaultShape: action.state.defaultShape,
        },
        effects: [{ kind: EffectType.RENDER_CONTENT, items: action.state.items }],
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
        model: { ...model, items: [] },
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
      const items: ScreenItem[] = model.items.map((it) => ({ ...it, size: action.size }));
      return {
        model: { ...model, defaultSize: action.size, items },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.SET_BADGE_COLOR: {
      const items: ScreenItem[] = model.items.map((it) => ({ ...it, color: action.color }));
      return {
        model: { ...model, defaultColor: action.color, items },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.SET_BADGE_SHAPE: {
      const items: ScreenItem[] = model.items.map((it) => ({ ...it, shape: action.shape }));
      return {
        model: { ...model, defaultShape: action.shape, items },
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
      const { fromId, toIndex } = action;
      const items = reorderItemLabel(model.items, fromId, toIndex);
      return {
        model: { ...model, items },
        effects: [{ kind: EffectType.PERSIST_STATE }, { kind: EffectType.RENDER_CONTENT, items }],
      };
    }

    case ActionType.PORT_DISCONNECTED:
      return {
        model: { ...model, status: 'DISCONNECTED', selectionEnabled: false },
        effects: [{ kind: EffectType.TOGGLE_SELECT_ON_CONTENT, enabled: false }],
      };

    case ActionType.CLOSE_PANEL_REQUESTED: {
      const fx = {
        kind: EffectType.CLOSE_PANEL_IF_MATCH,
        ...(action.tabId !== undefined ? { tabId: action.tabId } : {}),
      } as const;
      return { model, effects: [fx] };
    }

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
 * @param toIndex - Target index in `items` whose label becomes the new label.
 * @returns A new array with updated labels.
 * @throws RangeError if `toIndex` is out of bounds or Error if `fromId` not found.
 */
function reorderItemLabel(items: ScreenItem[], fromId: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    throw new RangeError(`toIndex out of range: ${toIndex}`);
  }

  const fromIdx = items.findIndex((i) => i.id === fromId);
  if (fromIdx === -1) {
    throw new Error(`Item not found for id=${fromId}`);
  }

  const fromLabel = items[fromIdx]!.label;
  const targetLabel = items[toIndex]!.label;

  if (fromLabel === targetLabel) {
    return items.slice();
  }

  const movingUp = targetLabel < fromLabel;

  return items.map((it) => {
    if (it.id === fromId) {
      return { ...it, label: targetLabel };
    }

    if (movingUp) {
      if (it.label >= targetLabel && it.label < fromLabel) {
        return { ...it, label: it.label + 1 };
      }
    } else {
      if (it.label <= targetLabel && it.label > fromLabel) {
        return { ...it, label: it.label - 1 };
      }
    }
    return it;
  });
}
