import type {
  Anchor,
  ContentSize,
  ItemColor,
  ItemGroup,
  ItemPosition,
  ItemShape,
  ScreenItem,
  ThemeMode,
} from '@common/types';
import type { CaptureArea, CaptureFormat } from '@panel/services/capture';
import type { StatusKey } from '@panel/view/status';

/**
 * ActionType
 * -----------------------------------------------------------------------------
 * An exhaustive list of *application-level events* consumed by the reducer (update.ts).
 * Origins:
 *   - View UI events (normalized by the Controller)
 *   - Messages from Content/Background scripts
 *   - Results of async I/O (capture success/failure, etc.)
 * Usage:
 *   - Acts as the discriminant for `switch(action.type)` in the reducer
 *   - Purely determines how the Model transitions (no side effects here)
 */
export enum ActionType {
  /** App bootstrap / start */
  INIT = 'INIT',

  /** Active tab resolved and connection established (tabId/pageKey decided) */
  CONNECTED = 'CONNECTED',

  /** Update panel status (CONNECTING / CONNECTED / RESTRICTED / DISCONNECTED, etc.) */
  SET_STATUS = 'SET_STATUS',

  /** Restore persisted state: items and defaults (size/color/shape) */
  RESTORE_STATE = 'RESTORE_STATE',

  /** Overwrites the set of elements that are not present in the content */
  SET_MISSING_IDS = 'SET_MISSING_IDS',

  /** Toggle selection mode on the page overlay */
  TOGGLE_SELECT = 'TOGGLE_SELECT',

  /** Clear all selections */
  CLEAR_ALL = 'CLEAR_ALL',

  /** Content → Panel: anchors were toggled (selected/unselected) on the page */
  CONTENT_SELECTED = 'CONTENT_SELECTED',

  /** Update default badge size (also apply to existing items) */
  SET_BADGE_SIZE = 'SET_BADGE_SIZE',

  /** Update default badge color (also apply to existing items) */
  SET_BADGE_COLOR = 'SET_BADGE_COLOR',

  /** Update default badge shape (also apply to existing items) */
  SET_BADGE_SHAPE = 'SET_BADGE_SHAPE',

  /** Delete the selected badge */
  BADGE_DELETE = 'BADGE_DELETE',

  /** Update default badge position (also apply to existing items) */
  SET_BADGE_POSITION = 'SET_BADGE_POSITION',

  /** Update capture format (png/jpeg) */
  SET_CAPTURE_FORMAT = 'SET_CAPTURE_FORMAT',

  /** Update capture area (full/viewport) */
  SET_CAPTURE_AREA = 'SET_CAPTURE_AREA',

  /** Update JPEG quality */
  SET_CAPTURE_QUALITY = 'SET_CAPTURE_QUALITY',

  /** Update capture scale factor */
  SET_CAPTURE_SCALE = 'SET_CAPTURE_SCALE',

  /** Toggle capture options dropdown (expand/collapse) */
  TOGGLE_CAPTURE_PANEL = 'TOGGLE_CAPTURE_PANEL',

  /** request measuring the content size */
  MEASURE_CONTENT_SIZE = 'MEASURE_CONTENT_SIZE',

  /** Request to run a capture */
  CAPTURE_REQUESTED = 'CAPTURE_REQUESTED',

  /** Capture completed successfully */
  CAPTURE_SUCCEEDED = 'CAPTURE_SUCCEEDED',

  /** Capture failed with an error */
  CAPTURE_FAILED = 'CAPTURE_FAILED',

  /** Reordering selected items (drag and drop) */
  REORDER_ITEMS = 'REORDER_ITEMS',

  /** Update a group of elements */
  SET_GROUP = 'SET_GROUP',

  /** Port disconnected (lost connection to Content/Service Worker) */
  PORT_DISCONNECTED = 'PORT_DISCONNECTED',

  /** Request to close the panel when the tabId matches (Background → Panel) */
  CLOSE_PANEL_REQUESTED = 'CLOSE_PANEL_REQUESTED',

  /** Emitted when an item's edit-selection checkbox changes state */
  ITEM_SELECTION_CHANGED = 'ITEM_SELECTION_CHANGED',

  /** Start item hover */
  ITEM_HOVER_IN = 'ITEM_HOVER_IN',

  /** End item hover */
  ITEM_HOVER_OUT = 'ITEM_HOVER_OUT',

  /** Persist the edited comment text for the targeted item */
  UPDATE_ITEM_COMMENT = 'UPDATE_ITEM_COMMENT',

  /** Sete UI theme */
  SET_THEME = 'SET_THEME',

  /** Update the UI theme */
  UPDATE_THEME = 'UPDATE_THEME',

  /** Dispatched to request reloading the latest data */
  STORE_RELOAD_REQUESTED = 'STORE_RELOAD_REQUESTED',

  /** Dispatched after the store is successfully reloaded with the latest data */
  STORE_RELOAD_SUCCEEDED = 'STORE_RELOAD_SUCCEEDED',

  /** Remove screen state by page key */
  REMOVE_SCREEN_STATE_BY_PAGE = 'REMOVE_SCREEN_STATE_BY_PAGE',
}

export type Action =
  | { type: ActionType.INIT }
  | { type: ActionType.CONNECTED; tabId: number; pageKey: string }
  | { type: ActionType.SET_STATUS; status: StatusKey }
  | {
      type: ActionType.RESTORE_STATE;
      state: {
        items: ScreenItem[];
        defaultSize: number;
        defaultColor: ItemColor;
        defaultShape: ItemShape;
        defaultPosition: ItemPosition;
        defaultGroup: ItemGroup;
      };
    }
  | { type: ActionType.SET_MISSING_IDS; missingIds: number[] }
  | { type: ActionType.TOGGLE_SELECT }
  | { type: ActionType.CLEAR_ALL }
  | { type: ActionType.CONTENT_SELECTED; anchors: Anchor[] }
  | { type: ActionType.SET_BADGE_SIZE; size: number }
  | { type: ActionType.SET_BADGE_COLOR; color: ItemColor }
  | { type: ActionType.SET_BADGE_SHAPE; shape: ItemShape }
  | { type: ActionType.SET_BADGE_POSITION; position: ItemPosition }
  | { type: ActionType.SET_CAPTURE_FORMAT; format: CaptureFormat }
  | { type: ActionType.SET_CAPTURE_AREA; area: CaptureArea }
  | { type: ActionType.SET_CAPTURE_QUALITY; quality: number }
  | { type: ActionType.SET_CAPTURE_SCALE; scale: number }
  | { type: ActionType.BADGE_DELETE }
  | { type: ActionType.TOGGLE_CAPTURE_PANEL }
  | { type: ActionType.MEASURE_CONTENT_SIZE }
  | { type: ActionType.CAPTURE_REQUESTED; contentSize: ContentSize }
  | { type: ActionType.CAPTURE_SUCCEEDED }
  | { type: ActionType.CAPTURE_FAILED; error: unknown }
  | { type: ActionType.REORDER_ITEMS; fromId: number; fromIndex: number; toIndex: number }
  | { type: ActionType.SET_GROUP; group: string }
  | { type: ActionType.ITEM_SELECTION_CHANGED; id: number; isCheck: boolean }
  | { type: ActionType.ITEM_SELECTION_CHANGED; group: string; isCheck: boolean }
  | { type: ActionType.ITEM_SELECTION_CHANGED; allCheck: boolean }
  | { type: ActionType.ITEM_HOVER_IN; id: number }
  | { type: ActionType.ITEM_HOVER_OUT }
  | { type: ActionType.UPDATE_ITEM_COMMENT; id: number; comment: string }
  | { type: ActionType.PORT_DISCONNECTED }
  | { type: ActionType.CLOSE_PANEL_REQUESTED; tabId?: number }
  | { type: ActionType.SET_THEME; theme: ThemeMode }
  | { type: ActionType.UPDATE_THEME; theme: ThemeMode }
  | { type: ActionType.STORE_RELOAD_REQUESTED }
  | { type: ActionType.STORE_RELOAD_SUCCEEDED; pageKeys: string[] }
  | { type: ActionType.REMOVE_SCREEN_STATE_BY_PAGE; pageKey: string };
