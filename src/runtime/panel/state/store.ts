import { type ScreenState, UNGROUPED_VALUE } from '@common/types';

const ROOT_KEY = 'screenStateByPage';
type StateMap = Record<string, ScreenState>;

/**
 * Loads the entire state map from chrome.storage.local under ROOT_KEY.
 *
 * @returns Promise resolving to the full state map; returns an empty object when nothing is stored.
 * @remarks This performs storage I/O.
 */
async function readAll(): Promise<StateMap> {
  const raw = await chrome.storage.local.get(ROOT_KEY);
  return (raw[ROOT_KEY] as StateMap) ?? {};
}

/**
 * Persists the entire state map to chrome.storage.local under ROOT_KEY.
 *
 * @param map - The complete state map to write.
 * @returns Promise that resolves when the write completes.
 * @remarks This overwrites the stored map for ROOT_KEY.
 */
async function writeAll(map: StateMap): Promise<void> {
  await chrome.storage.local.set({ [ROOT_KEY]: map });
}

/**
 * Retrieves the state bound to a page key.
 * Returns the initial default when the key has no stored state.
 *
 * @param pageKey - Page key that identifies the page state bucket.
 * @returns Promise resolving to the corresponding ScreenState.
 */
export async function getState(pageKey: string): Promise<ScreenState> {
  const map = await readAll();
  return (
    map[pageKey] ?? {
      items: [],
      nextId: 1,
      defaultSize: 14,
      defaultColor: 'Blue',
      defaultShape: 'circle',
      defaultPosition: 'left-top-outside',
      defaultGroup: UNGROUPED_VALUE,
    }
  );
}

/**
 * Stores the given state under the specified page key.
 *
 * @param pageKeyStr - Page key to associate with the state.
 * @param state - The ScreenState to persist.
 * @returns Promise that resolves when the write completes.
 */
export async function setState(pageKeyStr: string, state: ScreenState): Promise<void> {
  const map = await readAll();
  map[pageKeyStr] = state;
  await writeAll(map);
}
