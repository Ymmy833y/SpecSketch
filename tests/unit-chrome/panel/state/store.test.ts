import { type ScreenState, UNGROUPED_VALUE } from '@common/types';
import { getState, setState } from '@panel/state/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT_KEY = 'screenStateByPage';

type StateMap = Record<string, ScreenState>;
let memory: StateMap;

type StorageGet = (key?: string) => Promise<Record<string, unknown>>;
type StorageSet = (obj: Record<string, unknown>) => Promise<void>;
const storageGet = vi.mocked(chrome.storage.local.get as unknown as StorageGet);
const storageSet = vi.mocked(chrome.storage.local.set as unknown as StorageSet);

// A helper to replace get/set implementations that use memory stores
function useMemoryBackedStorage(initial?: StateMap) {
  memory = { ...(initial ?? {}) };

  storageGet.mockImplementation(async (key?: unknown) => {
    if (key === ROOT_KEY) {
      return { [ROOT_KEY]: memory };
    }
    return {};
  });

  storageSet.mockImplementation(async (obj: Record<string, unknown>) => {
    const map = obj[ROOT_KEY] as StateMap | undefined;
    if (map) {
      memory = map;
    }
  });
}

// Helper to create the default screen state
function makeState(partial?: Partial<ScreenState>): ScreenState {
  return {
    items: [],
    nextId: 1,
    defaultSize: 14,
    defaultColor: 'Blue',
    defaultShape: 'circle',
    defaultPosition: 'left-top-outside',
    defaultGroup: UNGROUPED_VALUE,
    ...(partial ?? {}),
  };
}

describe('panel/state/store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    storageGet.mockReset();
    storageSet.mockReset();
    memory = {};
  });

  describe('getState', () => {
    it('returns default state when no data is stored', async () => {
      // Arrange:
      storageGet.mockResolvedValue({});

      // Act
      const state = await getState('page-1');

      // Assert
      expect(state).toEqual({
        items: [],
        nextId: 1,
        defaultSize: 14,
        defaultColor: 'Blue',
        defaultShape: 'circle',
        defaultPosition: 'left-top-outside',
        defaultGroup: '',
      });
      expect(storageSet).not.toHaveBeenCalled();
    }, 1000);

    it('returns stored state when entry exists', async () => {
      // Arrange
      const stored: ScreenState = makeState({
        nextId: 5,
        defaultSize: 16,
        defaultColor: 'Blue',
        defaultShape: 'square',
        defaultGroup: UNGROUPED_VALUE,
      });
      useMemoryBackedStorage({ 'page-1': stored });

      // Act
      const state = await getState('page-1');

      // Assert
      expect(state).toEqual(stored);
    }, 1000);

    it('getState does not write when key is missing (read-only path)', async () => {
      // Arrange
      storageGet.mockResolvedValue({});

      // Act
      const state = await getState('x');

      // Assert
      expect(storageSet).not.toHaveBeenCalled();
      expect(state).toEqual(makeState());
    }, 1000);
  });

  describe('setState', () => {
    it('setState merges and preserves other keys', async () => {
      // Arrange: Save b from existing a key
      const stateA: ScreenState = makeState({ nextId: 2, defaultColor: 'Blue' });
      const stateB: ScreenState = makeState({
        nextId: 10,
        defaultColor: 'Blue',
        defaultShape: 'square',
      });
      useMemoryBackedStorage({ a: stateA });

      // Act
      await setState('b', stateB);

      // Assert: Validate arguments to set calls (designed to be overwritten and saved across all maps)
      expect(storageSet).toHaveBeenCalledTimes(1);
      expect(storageSet).toHaveBeenCalledWith({ [ROOT_KEY]: { a: stateA, b: stateB } });

      const readB = await getState('b');
      expect(readB).toEqual(stateB);
    }, 1000);

    it('setState overwrites existing key value', async () => {
      // Arrange
      const oldState: ScreenState = makeState({ defaultShape: 'circle' });
      const nextState: ScreenState = makeState({ defaultShape: 'square' });
      useMemoryBackedStorage({ a: oldState });

      // Act
      await setState('a', nextState);

      // Assert
      expect(storageSet).toHaveBeenCalledTimes(1);
      expect(storageSet).toHaveBeenCalledWith({ [ROOT_KEY]: { a: nextState } });

      const readA = await getState('a');
      expect(readA).toEqual(nextState);
    }, 1000);
  });
});
