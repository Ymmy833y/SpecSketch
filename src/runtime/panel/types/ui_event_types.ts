/**
 * UIEventType / UIEventPayloadMap
 * -----------------------------------------------------------------------------
 * A typed catalog of *pure UI events* emitted by the View (panel_view.ts).
 * - The View reads DOM state, normalizes it, and emits one of these events.
 * - The Controller maps each UI event to an ActionType and dispatches it.
 * - Payloads are strongly typed via UIEventPayloadMap; use `undefined` for no payload.
 */

import type { ItemColor, ItemShape } from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';

export enum UIEventType {
  /** Toggle selection mode */
  TOGGLE_SELECT = 'TOGGLE_SELECT',

  /** Clear all selections */
  CLEAR = 'CLEAR',

  /** Trigger page capture */
  CAPTURE = 'CAPTURE',

  /** Badge size changed (range/number inputs) */
  BADGE_SIZE_CHANGE = 'BADGE_SIZE_CHANGE',

  /** Badge color picked (popover buttons) */
  BADGE_COLOR_SELECT = 'BADGE_COLOR_SELECT',

  /** Badge shape changed (select) */
  BADGE_SHAPE_CHANGE = 'BADGE_SHAPE_CHANGE',

  /** Capture format changed (radio) */
  CAPTURE_FORMAT_CHANGE = 'CAPTURE_FORMAT_CHANGE',

  /** Capture area changed (radio) */
  CAPTURE_AREA_CHANGE = 'CAPTURE_AREA_CHANGE',

  /** JPEG quality changed (range/number) */
  CAPTURE_QUALITY_CHANGE = 'CAPTURE_QUALITY_CHANGE',

  /** Capture scale changed (range/number) */
  CAPTURE_SCALE_CHANGE = 'CAPTURE_SCALE_CHANGE',

  /** Toggle capture options dropdown (expand/collapse) */
  TOGGLE_CAPTURE_PANEL = 'TOGGLE_CAPTURE_PANEL',

  /** Reordering selected items (drag and drop) */
  REORDER_ITEMS = 'REORDER_ITEMS',

  /** Update a group of elements */
  SET_ITEM_GROUP = 'SET_ITEM_GROUP',
}

/**
 * UIEventPayloadMap
 * -----------------------------------------------------------------------------
 * Strongly-typed payloads per UIEventType.
 * Use `undefined` when an event carries no additional data.
 */
export type UIEventPayloadMap = {
  [UIEventType.TOGGLE_SELECT]: undefined;
  [UIEventType.CLEAR]: undefined;
  [UIEventType.CAPTURE]: undefined;

  [UIEventType.BADGE_SIZE_CHANGE]: { size: number };
  [UIEventType.BADGE_COLOR_SELECT]: { color: ItemColor };
  [UIEventType.BADGE_SHAPE_CHANGE]: { shape: ItemShape };

  [UIEventType.CAPTURE_FORMAT_CHANGE]: { format: CaptureFormat };
  [UIEventType.CAPTURE_AREA_CHANGE]: { area: CaptureArea };
  [UIEventType.CAPTURE_QUALITY_CHANGE]: { quality: number };
  [UIEventType.CAPTURE_SCALE_CHANGE]: { scale: number };

  [UIEventType.TOGGLE_CAPTURE_PANEL]: undefined;

  [UIEventType.REORDER_ITEMS]: { fromId: number; fromIndex: number; toIndex: number };
  [UIEventType.SET_ITEM_GROUP]: { id: number; group: string };
};
