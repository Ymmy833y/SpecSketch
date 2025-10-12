import { type ScreenState, UNGROUPED_VALUE } from '@common/types';
import { screenStateTable, themeTable } from '@panel/storage/tables';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SCREEN_STATE_KEY = 'screenStateByPage';
const THEME_KEY = 'themeMode';

type StateMap = Record<string, ScreenState>;
let memory: StateMap;
let themeMemory: string | undefined;

type StorageGet = (key?: string) => Promise<Record<string, unknown>>;
type StorageSet = (obj: Record<string, unknown>) => Promise<void>;
type StorageRemove = (key: string) => Promise<void>;

const storageGet = vi.mocked(chrome.storage.local.get as unknown as StorageGet);
const storageSet = vi.mocked(chrome.storage.local.set as unknown as StorageSet);
const storageRemove = vi.mocked(chrome.storage.local.remove as unknown as StorageRemove);

/**
 * Memory-backed storage mock initializer for both:
 * - screenState map under ROOT_KEY
 * - theme singleton under THEME_KEY
 */
function useMemoryBackedStorage(initial?: { stateMap?: StateMap; theme?: string }) {
  memory = { ...(initial?.stateMap ?? {}) };
  themeMemory = initial?.theme;

  storageGet.mockImplementation(async (key?: unknown) => {
    if (key === SCREEN_STATE_KEY) {
      return { [SCREEN_STATE_KEY]: memory };
    }
    if (key === THEME_KEY) {
      return { [THEME_KEY]: themeMemory };
    }
    return {};
  });

  storageSet.mockImplementation(async (obj: Record<string, unknown>) => {
    if (SCREEN_STATE_KEY in obj) {
      const map = obj[SCREEN_STATE_KEY] as StateMap | undefined;
      if (map) memory = map;
    }
    if (THEME_KEY in obj) {
      themeMemory = obj[THEME_KEY] as string;
    }
  });

  storageRemove.mockImplementation(async (key: string) => {
    if (key === THEME_KEY) {
      themeMemory = undefined;
    }
    // Note: We do not remove the whole ROOT_KEY map in these tests.
  });
}

// Helper to create the default screen state (must match defaultScreenState())
function makeState(partial?: Partial<ScreenState>): ScreenState {
  return {
    items: [],
    nextId: 1,
    defaultSize: 14,
    defaultColor: 'Blue',
    defaultShape: 'circle',
    defaultLabelFormat: 'Numbers',
    defaultPosition: 'left-top-outside',
    defaultGroup: UNGROUPED_VALUE,
    ...(partial ?? {}),
  };
}

describe('panel/storage/tables', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    storageGet.mockReset();
    storageSet.mockReset();
    storageRemove.mockReset();
    memory = {};
    themeMemory = undefined;
  });

  describe('screenStateTable', () => {
    describe('get', () => {
      it('returns default state when no data is stored', async () => {
        // Arrange: no data
        storageGet.mockResolvedValue({});

        // Act
        const state = await screenStateTable.get('page-1');

        // Assert
        expect(state).toEqual(makeState());
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
        useMemoryBackedStorage({ stateMap: { 'page-1': stored } });

        // Act
        const state = await screenStateTable.get('page-1');

        // Assert
        expect(state).toEqual(stored);
      }, 1000);

      it('does not write when key is missing (read-only path)', async () => {
        // Arrange
        storageGet.mockResolvedValue({});

        // Act
        const state = await screenStateTable.get('x');

        // Assert
        expect(storageSet).not.toHaveBeenCalled();
        expect(state).toEqual(makeState());
      }, 1000);
    });

    describe('set', () => {
      it('merges and preserves other keys', async () => {
        // Arrange: Save b while existing a remains
        const stateA: ScreenState = makeState({ nextId: 2, defaultColor: 'Blue' });
        const stateB: ScreenState = makeState({
          nextId: 10,
          defaultColor: 'Blue',
          defaultShape: 'square',
        });
        useMemoryBackedStorage({ stateMap: { a: stateA } });

        // Act
        await screenStateTable.set('b', stateB);

        // Assert: single write with both keys
        expect(storageSet).toHaveBeenCalledTimes(1);
        expect(storageSet).toHaveBeenCalledWith({ [SCREEN_STATE_KEY]: { a: stateA, b: stateB } });

        const readB = await screenStateTable.get('b');
        expect(readB).toEqual(stateB);
      }, 1000);

      it('overwrites existing key value', async () => {
        // Arrange
        const oldState: ScreenState = makeState({ defaultShape: 'circle' });
        const nextState: ScreenState = makeState({ defaultShape: 'square' });
        useMemoryBackedStorage({ stateMap: { a: oldState } });

        // Act
        await screenStateTable.set('a', nextState);

        // Assert
        expect(storageSet).toHaveBeenCalledTimes(1);
        expect(storageSet).toHaveBeenCalledWith({ [SCREEN_STATE_KEY]: { a: nextState } });

        const readA = await screenStateTable.get('a');
        expect(readA).toEqual(nextState);
      }, 1000);
    });
  });

  describe('themeTable', () => {
    it('get: returns default "device" when not set (no write)', async () => {
      // Arrange
      useMemoryBackedStorage(); // themeMemory = undefined

      // Act
      const t = await themeTable.get();

      // Assert
      expect(t).toBe('device');
      expect(storageSet).not.toHaveBeenCalled();
      expect(storageRemove).not.toHaveBeenCalled();
      expect(storageGet).toHaveBeenCalledWith(THEME_KEY);
    }, 1000);

    it('set: persists theme and get returns it', async () => {
      // Arrange
      useMemoryBackedStorage();

      // Act
      await themeTable.set('dark');
      const t = await themeTable.get();

      // Assert
      expect(storageSet).toHaveBeenCalledWith({ [THEME_KEY]: 'dark' });
      expect(t).toBe('dark');
    }, 1000);

    it('remove: clears theme; subsequent get falls back to default', async () => {
      // Arrange
      useMemoryBackedStorage({ theme: 'light' });

      // Act
      await themeTable.remove();
      const t = await themeTable.get();

      // Assert
      expect(storageRemove).toHaveBeenCalledWith(THEME_KEY);
      expect(t).toBe('device');
    }, 1000);

    it('get: returns stored theme when present', async () => {
      // Arrange
      useMemoryBackedStorage({ theme: 'dark' });

      // Act
      const t = await themeTable.get();

      // Assert
      expect(t).toBe('dark');
      expect(storageSet).not.toHaveBeenCalled();
    }, 1000);
  });
});
