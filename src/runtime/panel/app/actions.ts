import type { Anchor, ItemColor, ItemShape, ScreenItem } from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import type { StatusKey } from '@panel/view/status';

import { ActionType } from '../types/action_types';

export type Action =
  | { type: ActionType.INIT }
  | { type: ActionType.CONNECTED; tabId: number; pageKey: string }
  | { type: ActionType.SET_STATUS; status: StatusKey }
  | {
      type: ActionType.RESTORE_STATE;
      state: {
        items: ScreenItem[];
        nextLabel: number;
        defaultSize: number;
        defaultColor: ItemColor;
        defaultShape: ItemShape;
      };
    }
  | { type: ActionType.SET_MISSING_IDS; missingIds: number[] }
  | { type: ActionType.TOGGLE_SELECT }
  | { type: ActionType.CLEAR_ALL }
  | { type: ActionType.CONTENT_SELECTED; anchors: Anchor[] }
  | { type: ActionType.SET_BADGE_SIZE; size: number }
  | { type: ActionType.SET_BADGE_COLOR; color: ItemColor }
  | { type: ActionType.SET_BADGE_SHAPE; shape: ItemShape }
  | { type: ActionType.SET_CAPTURE_FORMAT; format: CaptureFormat }
  | { type: ActionType.SET_CAPTURE_AREA; area: CaptureArea }
  | { type: ActionType.SET_CAPTURE_QUALITY; quality: number }
  | { type: ActionType.SET_CAPTURE_SCALE; scale: number }
  | { type: ActionType.BADGE_DELETE }
  | { type: ActionType.TOGGLE_CAPTURE_PANEL }
  | { type: ActionType.CAPTURE_REQUESTED }
  | { type: ActionType.CAPTURE_SUCCEEDED }
  | { type: ActionType.CAPTURE_FAILED; error: unknown }
  | { type: ActionType.REORDER_ITEMS; fromId: number; fromIndex: number; toIndex: number }
  | { type: ActionType.SET_ITEM_GROUP; id: number; group: string }
  | { type: ActionType.ITEM_SELECTION_CHANGED; id: number; isCheck: boolean }
  | { type: ActionType.ITEM_SELECTION_CHANGED; group: string; isCheck: boolean }
  | { type: ActionType.ITEM_SELECTION_CHANGED; allCheck: boolean }
  | { type: ActionType.ITEM_HOVER_IN; id: number }
  | { type: ActionType.ITEM_HOVER_OUT }
  | { type: ActionType.PORT_DISCONNECTED }
  | { type: ActionType.CLOSE_PANEL_REQUESTED; tabId?: number };
