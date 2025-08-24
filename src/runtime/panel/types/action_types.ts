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

  /** Request to run a capture */
  CAPTURE_REQUESTED = 'CAPTURE_REQUESTED',

  /** Capture completed successfully */
  CAPTURE_SUCCEEDED = 'CAPTURE_SUCCEEDED',

  /** Capture failed with an error */
  CAPTURE_FAILED = 'CAPTURE_FAILED',

  /** Reordering selected items (drag and drop) */
  REORDER_ITEMS = 'REORDER_ITEMS',

  /** Update a group of elements */
  SET_ITEM_GROUP = 'SET_ITEM_GROUP',

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
}
