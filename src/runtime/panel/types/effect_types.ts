import { ContentSize, ScreenItem, ThemeMode } from '@common/types';

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

  /** request measuring the content size */
  MEASURE_CONTENT_SIZE = 'MEASURE_CONTENT_SIZE',

  /** Run a capture with the given parameters (tabId/format/area/quality/scale) */
  CAPTURE = 'CAPTURE',

  /** Persist the state to storage with selected items reset (cleared). */
  CLEAR_STATE = 'CLEAR_STATE',

  /**
   * Persist the current state to storage.
   * NOTE: Must preserve existing counters (nextId/nextLabel); do not reset them.
   */
  PERSIST_STATE = 'PERSIST_STATE',

  /** Sete UI theme */
  SET_THEME = 'SET_THEME',

  /** Update the UI theme */
  UPDATE_THEME = 'UPDATE_THEME',

  /** Read the screen-state map from `chrome.storage.local` */
  READ_SCREEN_STATE_STORE = 'READ_SCREEN_STATE_STORE',

  /** Import a ScreenState from a selected JSON file. */
  IMPORT_SCREAN_STATE_FILE = 'IMPORT_SCREAN_STATE_FILE',

  /** Remove screen state by page key */
  REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY = 'REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY',

  /** Export screen state by page key */
  EXPORT_SCREEN_STATE_BY_PAGE_KEY = 'EXPORT_SCREEN_STATE_BY_PAGE_KEY',

  /** Report/log an error (and optionally surface it to the UI) */
  NOTIFY_ERROR = 'NOTIFY_ERROR',
}

export type Effect =
  | { kind: EffectType.RENDER_CONTENT; items: ScreenItem[] }
  | { kind: EffectType.TOGGLE_SELECT_ON_CONTENT; enabled: boolean }
  | { kind: EffectType.CLEAR_CONTENT }
  | { kind: EffectType.HOVER; id: number | null }
  | { kind: EffectType.MEASURE_CONTENT_SIZE }
  | {
      kind: EffectType.CAPTURE;
      payload: {
        tabId: number;
        format: 'png' | 'jpeg';
        area: 'full' | 'viewport';
        quality: number;
        scale: number;
        contentSize: ContentSize;
      };
    }
  | { kind: EffectType.CLEAR_STATE }
  | { kind: EffectType.PERSIST_STATE }
  | { kind: EffectType.SET_THEME }
  | { kind: EffectType.UPDATE_THEME; theme: ThemeMode }
  | { kind: EffectType.READ_SCREEN_STATE_STORE }
  | { kind: EffectType.IMPORT_SCREAN_STATE_FILE; file: File }
  | { kind: EffectType.REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY; pageKey: string }
  | { kind: EffectType.EXPORT_SCREEN_STATE_BY_PAGE_KEY; pageKey: string }
  | { kind: EffectType.NOTIFY_ERROR; error: unknown };
