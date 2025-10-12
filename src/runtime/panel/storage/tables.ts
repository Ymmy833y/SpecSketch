import { type ScreenState, ThemeMode, UNGROUPED_VALUE } from '@common/types';

/**
 * Creates a key-scoped “map table” that stores a record `{ [pageKey]: T }`
 * under a single root key in `chrome.storage.local`.
 *
 * Use this for per-page or per-scope state where values are distinguished by a row key.
 *
 * @typeParam T - Value type stored per row.
 * @param rootKey - Root key (without namespace prefix) under which the entire map is stored.
 * @param defaultOf - Optional factory that returns a default value when a row is missing.
 * @returns An object with CRUD helpers for the table: `{ key, readAll, writeAll, get, set, remove, clear }`.
 */
export function createMapTable<T>(rootKey: string, defaultOf?: (pageKey: string) => T) {
  const KEY = rootKey;
  type MapT = Record<string, T>;

  /**
   * Loads the entire state map from `chrome.storage.local` for this table.
   *
   * @returns Promise resolving to the full state map; returns an empty object when nothing is stored.
   * @remarks Performs storage I/O on every call.
   */
  async function readAll(): Promise<MapT> {
    const raw = await chrome.storage.local.get(KEY);
    return (raw[KEY] as MapT) ?? {};
  }

  /**
   * Persists the entire state map to `chrome.storage.local` for this table.
   *
   * @param map - The complete state map to write.
   * @returns Promise that resolves when the write completes.
   */
  async function writeAll(map: MapT): Promise<void> {
    await chrome.storage.local.set({ [KEY]: map });
  }

  /**
   * Retrieves a single row by its page key.
   *
   * @param pageKey - Row key (e.g., page identifier).
   * @returns Promise resolving to the stored value; if missing and `defaultOf` is provided, that default is returned.
   * @remarks When `defaultOf` is not provided and the row is missing, `undefined` is returned (typed as `T`).
   */
  async function get(pageKey: string): Promise<T> {
    const map = await readAll();
    const found = map[pageKey];
    if (found !== undefined) return found;
    if (defaultOf) return defaultOf(pageKey);
    return undefined as unknown as T;
  }

  /**
   * Upserts a single row for the given page key.
   *
   * @param pageKey - Row key to write.
   * @param value - Value to persist.
   */
  async function set(pageKey: string, value: T): Promise<void> {
    const map = await readAll();
    map[pageKey] = value;
    await writeAll(map);
  }

  /**
   * Deletes a single row for the given page key.
   *
   * @param pageKey - Row key to delete.
   */
  async function remove(pageKey: string): Promise<void> {
    const map = await readAll();
    if (pageKey in map) {
      delete map[pageKey];
      await writeAll(map);
    }
  }

  /**
   * Clears the entire table (removes all rows under this root key).
   */
  async function clear(): Promise<void> {
    await writeAll({});
  }

  return { key: KEY, readAll, writeAll, get, set, remove, clear };
}

/**
 * Creates a key-scoped “singleton” store that saves a single value directly
 * under the given root key in `chrome.storage.local`.
 *
 * Use this for global settings or any configuration that is not keyed by page.
 *
 * @typeParam T - Value type stored as a singleton.
 * @param rootKey - Root key (without namespace prefix) under which the value is stored.
 * @param defaultFactory - Factory function to lazily supply the default when no value exists.
 * @returns An object with helpers for the singleton: `{ key, get, set, remove }`.
 */
export function createSingleton<T>(rootKey: string, defaultFactory: () => T) {
  const KEY = rootKey;

  /**
   * Reads the singleton value from storage.
   *
   * @returns Promise resolving to the stored value; falls back to `defaultFactory()` when missing.
   */
  async function get(): Promise<T> {
    const raw = await chrome.storage.local.get(KEY);
    const val = raw[KEY] as T | undefined;
    return val === undefined ? defaultFactory() : val;
  }

  /**
   * Writes the singleton value to storage.
   *
   * @param value - Value to persist.
   */
  async function set(value: T): Promise<void> {
    await chrome.storage.local.set({ [KEY]: value });
  }

  /**
   * Removes the singleton value from storage.
   */
  async function remove(): Promise<void> {
    await chrome.storage.local.remove(KEY);
  }

  return { key: KEY, get, set, remove };
}

function defaultScreenState(): ScreenState {
  return {
    items: [],
    nextId: 1,
    defaultSize: 14,
    defaultColor: 'Blue',
    defaultShape: 'circle',
    defaultLabelFormat: 'Numbers',
    defaultVisible: true,
    defaultPosition: 'left-top-outside',
    defaultGroup: UNGROUPED_VALUE,
  };
}

/**
 * Table for per-page `ScreenState` values.
 * Each row is addressed by a page key; missing rows fall back to `defaultScreenState()`.
 */
export const screenStateTable = createMapTable<ScreenState>('screenStateByPage', () =>
  defaultScreenState(),
);

/**
 * Singleton for global theme mode.
 * Stores a single `ThemeMode` value; defaults to `'device'` when not set.
 */
export const themeTable = createSingleton<ThemeMode>('themeMode', () => 'device');
