/**
 * EffectType
 * -----------------------------------------------------------------------------
 * A declarative set of *side-effect requests* produced by the reducer.
 * Executor:
 *   - The Controller interprets and performs each effect (I/O, RPC, persistence).
 * Purpose:
 *   - Keep the reducer pure while still enabling necessary external effects.
 */
export enum EffectType {
  /** Push the current items to the Content script to render the overlay */
  RENDER_CONTENT = 'RENDER_CONTENT',

  /** Enable/disable selection mode on the Content side */
  TOGGLE_SELECT_ON_CONTENT = 'TOGGLE_SELECT_ON_CONTENT',

  /** Clear overlay on the Content side */
  CLEAR_CONTENT = 'CLEAR_CONTENT',

  /** item hover */
  HOVER = 'HOVER',

  /** Run a capture with the given parameters (tabId/format/area/quality/scale) */
  CAPTURE = 'CAPTURE',

  /** Persist the state to storage with selected items reset (cleared). */
  CLEAR_STATE = 'CLEAR_STATE',

  /**
   * Persist the current state to storage.
   * NOTE: Must preserve existing counters (nextId/nextLabel); do not reset them.
   */
  PERSIST_STATE = 'PERSIST_STATE',

  /** Report/log an error (and optionally surface it to the UI) */
  NOTIFY_ERROR = 'NOTIFY_ERROR',
}
