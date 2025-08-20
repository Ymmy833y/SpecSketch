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
