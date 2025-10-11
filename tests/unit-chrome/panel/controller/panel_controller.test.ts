import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

// ------ Module mocks (declare BEFORE importing SUT) ------

vi.mock('@panel/app/update.ts', () => ({
  update: vi.fn(),
}));

vi.mock('@common/url.ts', () => ({
  isRestricted: vi.fn(() => false),
  pageKey: (url: string) => `key:${url}`,
}));

vi.mock('@infra/chrome/tabs.ts', () => ({
  getActiveTab: vi.fn(
    async () =>
      ({
        id: 1,
        index: 0,
        windowId: 111,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        audible: false,
        autoDiscardable: true,
        discarded: false,
        groupId: -1,
        url: 'https://example.com/',
        title: 'Example',
      }) as unknown as chrome.tabs.Tab,
  ),
}));

vi.mock('@panel/messaging/connection.ts', () => ({
  connectToTab: vi.fn(),
}));

vi.mock('@panel/services/capture.ts', () => ({
  capture: vi.fn(),
}));

vi.mock('@panel/services/export.ts', () => ({
  exportScreenState: vi.fn(),
}));

vi.mock('@panel/services/state.ts', () => ({
  handleSelected: vi.fn(async () => ({
    items: [], // ScreenItem[]
    nextId: 1,
    nextLabel: 1,
    defaultSize: 12,
    defaultColor: 'Red',
    defaultShape: 'circle',
  })),
}));

vi.mock('@panel/state/store.ts', () => ({
  getState: vi.fn(async () => ({
    items: [], // ScreenItem[]
    nextId: 1,
    nextLabel: 1,
    defaultSize: 12,
    defaultColor: 'Red',
    defaultShape: 'circle',
  })),
  setState: vi.fn(async () => undefined),
}));

// Replace the PanelView with a test double
vi.mock('@panel/view/panel_view.ts', () => ({
  PanelView: class {},
}));

// ------ Import SUT and dependencies ------
import { MSG_TYPE } from '@common/messages';
import { ItemPosition, UNGROUPED_VALUE } from '@common/types';
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { update } from '@panel/app/update';
import { PanelController } from '@panel/controller/panel_controller';
import { connectToTab } from '@panel/messaging/connection';
import { capture } from '@panel/services/capture';
import { exportScreenState } from '@panel/services/export';
import { screenStateTable, themeTable } from '@panel/storage/tables';
import { ActionType } from '@panel/types/action_types';
import { EffectType } from '@panel/types/effect_types';
import { UIEventType } from '@panel/types/ui_event_types';

// ------ helpers ------

const makeItem = (
  id = 1,
  overrides: Partial<{
    label: number;
    anchor: { kind: 'css'; value: string; version: 1 };
    size: number;
    color:
      | 'Gray'
      | 'Red'
      | 'Yellow'
      | 'Green'
      | 'Blue'
      | 'Lime'
      | 'Purple'
      | 'Pink'
      | 'Orange'
      | 'Cyan';
    shape: 'circle' | 'square';
    group?: string;
    position: ItemPosition;
  }> = {},
) => ({
  id,
  label: overrides.label ?? id,
  anchor: overrides.anchor ?? { kind: 'css', value: `#item-${id}`, version: 1 },
  size: overrides.size ?? 12,
  color: overrides.color ?? 'Red',
  shape: overrides.shape ?? 'circle',
  position: overrides.position ?? 'left-top-outside',
  ...(overrides.group ? { group: overrides.group } : {}),
});

const makeTab = (overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab =>
  ({
    id: 1,
    index: 0,
    windowId: 111,
    highlighted: false,
    active: true,
    pinned: false,
    incognito: false,
    audible: false,
    autoDiscardable: true,
    discarded: false,
    groupId: -1,
    url: 'https://example.com/',
    title: 'Example',
    ...overrides,
  }) as unknown as chrome.tabs.Tab;

class ViewStub {
  private handlers = new Map<string, (payload?: unknown) => void>();
  public render = vi.fn((_model: unknown) => undefined);
  public on = vi.fn((type: string, handler: (payload?: unknown) => void) => {
    this.handlers.set(type, handler);
  });
  public emit(type: string, payload?: unknown) {
    this.handlers.get(type)?.(payload);
  }
}

function makeConnStub() {
  const onDisconnectHandlers: Array<() => void> = [];
  const conn = {
    port: {
      onMessage: {
        addListener: vi.fn(),
      },
      disconnect: vi.fn(),
    },
    onDisconnect: (cb: () => void) => {
      onDisconnectHandlers.push(cb);
    },
    api: {
      ping: vi.fn(async () => undefined),
      render: vi.fn(async (_items: unknown) => undefined),
      toggleSelect: vi.fn(async (_enabled: boolean) => undefined),
      clear: vi.fn(async () => undefined),
      hover: vi.fn(async (_id: number | null) => undefined),
      measureSize: vi.fn(async () => undefined),
    },
    _fireDisconnect() {
      for (const cb of onDisconnectHandlers) cb();
    },
  };
  return conn;
}

function callPrivate<T>(target: object, name: string, ...args: unknown[]): T {
  const fn = (target as unknown as Record<string, unknown>)[name] as unknown as (
    ...a: unknown[]
  ) => T;
  return fn.apply(target, args);
}

describe('panel/controller/panel_controller', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const win = (
      globalThis.chrome as unknown as {
        windows: { getCurrent: MockInstance<() => Promise<{ id?: number }>> };
      }
    ).windows;
    win.getCurrent.mockReset();
    win.getCurrent.mockResolvedValue({ id: 111 });

    vi.mocked(getActiveTab).mockReset();
    vi.mocked(getActiveTab).mockResolvedValue(makeTab());

    vi.mocked(isRestricted).mockReset();
    vi.mocked(isRestricted).mockReturnValue(false);

    vi.mocked(connectToTab).mockReset();
    vi.mocked(capture).mockReset();

    // Mock update (using ReturnType<typeof vi.fn> to avoid type mismatch)
    const updateMock = update as unknown as ReturnType<typeof vi.fn>;
    updateMock.mockReset();
    updateMock.mockImplementation((_model: unknown, _action: unknown) => ({
      model: {
        pageKey: 'old-key',
        items: [], // ScreenItem[]
        nextId: 1,
        nextLabel: 1,
        defaultSize: 12,
        defaultColor: 'Red',
        defaultShape: 'circle',
      },
      effects: [],
    }));
  });

  describe('start', () => {
    it('renders and returns early when connection is not available', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: (opts?: {
          forceReconnect: boolean;
        }) => Promise<{ ok: false } | { ok: true; contextChanged: boolean }>;
      };
      const ensure = vi
        .spyOn(pc as unknown as Exposed, 'ensureConnectionAlive')
        .mockResolvedValue({ ok: false });

      await pc.start();

      expect(ensure).toHaveBeenCalledWith({ forceReconnect: true });
      expect(view.render).toHaveBeenCalledTimes(2);
      expect(view.on).not.toHaveBeenCalled();
    });

    it('registers handlers and reconnects on ACTIVE_TAB_CHANGED for the same window', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: (opts?: {
          forceReconnect: boolean;
        }) => Promise<{ ok: true; contextChanged: boolean }>;
      };
      const ensure = vi
        .spyOn(pc as unknown as Exposed, 'ensureConnectionAlive')
        .mockResolvedValue({ ok: true, contextChanged: false });

      await pc.start();

      const add = chrome.runtime.onMessage.addListener as unknown as MockInstance<
        (cb: (msg: unknown) => void) => void
      >;
      expect(add).toHaveBeenCalledTimes(1);
      const cb = add.mock.calls[0]?.[0] as (msg: unknown) => void;

      cb({
        type: MSG_TYPE.ACTIVE_TAB_CHANGED,
        payload: { windowId: 111, tabId: 1, url: 'https://example.com/' },
      });

      expect(ensure).toHaveBeenCalledWith({ forceReconnect: true });
      expect(view.on).toHaveBeenCalled();
    });

    it('view handlers trigger dispatch (sample: TOGGLE_SELECT & CAPTURE_REQUESTED)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();
      view.emit(UIEventType.TOGGLE_SELECT);
      view.emit(UIEventType.CAPTURE);

      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.TOGGLE_SELECT });
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.MEASURE_CONTENT_SIZE });
    });

    it('view handler BADGE_POSITION_SELECT dispatches SET_BADGE_POSITION with payload', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();

      const position: ItemPosition = 'top-outside';
      view.emit(UIEventType.BADGE_POSITION_SELECT, { position });

      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.SET_BADGE_POSITION,
        position: 'top-outside',
      });
    });

    it('view handler ITEM_COMMENT_APPLY dispatches UPDATE_ITEM_COMMENT with payload', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();

      const id = 7;
      const comment = 'line1\nline2';
      view.emit(UIEventType.ITEM_COMMENT_APPLY, { id, comment });

      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.UPDATE_ITEM_COMMENT,
        id,
        comment,
      });
    });

    it('view handler ITEM_COMMENT_APPLY dispatches UPDATE_ITEM_COMMENT with empty comment (clear)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();

      const id = 42;
      const comment = ''; // clear
      view.emit(UIEventType.ITEM_COMMENT_APPLY, { id, comment });

      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.UPDATE_ITEM_COMMENT,
        id,
        comment: '',
      });
    });

    it('view handler SETTING_MODAL_SHOW dispatches STORE_RELOAD_REQUESTED', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();

      // Fire the UI event and assert the dispatched action
      view.emit(UIEventType.SETTING_MODAL_SHOW);

      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.STORE_RELOAD_REQUESTED,
      });
    });

    it('view handler REMOVE_PAGE_CLICK dispatches REMOVE_SCREEN_STATE_BY_PAGE with payload', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();

      const targetKey = 'key://to-remove';
      view.emit(UIEventType.REMOVE_PAGE_CLICK, { pageKey: targetKey });

      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.REMOVE_SCREEN_STATE_BY_PAGE,
        pageKey: targetKey,
      });
    });

    it('view handler EXPORT_PAGE_CLICK dispatches EXPORT_SCREEN_STATE_BY_PAGE with payload', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
        dispatch: (a: unknown) => void;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await pc.start();

      const targetKey = 'key://to-export';
      view.emit(UIEventType.EXPORT_PAGE_CLICK, { pageKey: targetKey });

      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.EXPORT_SCREEN_STATE_BY_PAGE,
        pageKey: targetKey,
      });
    });
  });

  describe('ensureConnectionAlive', () => {
    it('ensureConnectionAlive: returns immediately when conn.api.ping responds', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      (pc as unknown as Record<string, unknown>)['conn'] = {
        api: { ping: vi.fn(async () => 'pong') },
      };

      const r = await callPrivate<{ ok: true; contextChanged: boolean }>(
        pc,
        'ensureConnectionAlive',
      );

      expect(r).toEqual({ ok: true, contextChanged: false });
      expect(getActiveTab).not.toHaveBeenCalled();
      expect(connectToTab).not.toHaveBeenCalled();
    });

    it('restricted URL sets status and returns {ok:false}', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      vi.mocked(isRestricted).mockReturnValue(true);

      type Exposed = { dispatch: (a: unknown) => void };
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const r = await callPrivate<{ ok: false }>(pc, 'ensureConnectionAlive', {
        forceReconnect: true,
      });

      expect(r).toEqual({ ok: false });
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.SET_STATUS, status: 'RESTRICTED' });
    });

    it('connects, restores state, and returns contextChanged=true when pageKey differs', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      (pc as unknown as { model: { pageKey: string } }).model.pageKey = 'old-key';
      vi.mocked(getActiveTab).mockResolvedValue(makeTab({ url: 'https://new.example/' }));

      const conn = makeConnStub();
      vi.mocked(connectToTab).mockResolvedValue(conn as unknown as never);
      vi.spyOn(screenStateTable, 'get').mockResolvedValue({
        items: [makeItem(1), makeItem(2)],
        nextId: 5,
        defaultSize: 10,
        defaultColor: 'Blue',
        defaultShape: 'square',
        defaultPosition: 'left-top-outside',
        defaultGroup: UNGROUPED_VALUE,
      });

      type Exposed = { dispatch: (a: unknown) => void };
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const r = await callPrivate<{ ok: true; contextChanged: boolean }>(
        pc,
        'ensureConnectionAlive',
        { forceReconnect: true },
      );

      expect(r).toEqual({ ok: true, contextChanged: true });
      expect(connectToTab).toHaveBeenCalledWith(1);
      expect(conn.port.onMessage.addListener).toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.CONNECTED,
        tabId: 1,
        pageKey: pageKey('https://new.example/'),
      });
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.SET_STATUS, status: 'CONNECTING' });
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.RESTORE_STATE,
        state: expect.objectContaining({
          items: [makeItem(1), makeItem(2)],
          defaultShape: 'square',
        }),
      });
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.SET_STATUS, status: 'CONNECTED' });
    });

    it('on CONTENT_SIZE_RESULT message, dispatches CAPTURE_REQUESTED with payload', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      (pc as unknown as { model: { pageKey: string } }).model.pageKey = 'old-key';

      const conn = makeConnStub();
      vi.mocked(connectToTab).mockResolvedValue(conn as unknown as never);

      vi.mocked(getActiveTab).mockResolvedValue(
        makeTab({ url: 'https://example.com/content-size' }),
      );
      vi.spyOn(screenStateTable, 'get').mockResolvedValue({
        items: [],
        nextId: 1,
        defaultSize: 12,
        defaultColor: 'Red',
        defaultShape: 'circle',
        defaultPosition: 'left-top-outside',
        defaultGroup: UNGROUPED_VALUE,
      });

      type Exposed = { dispatch: (a: unknown) => void };
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      await callPrivate<{ ok: true; contextChanged: boolean }>(pc, 'ensureConnectionAlive', {
        forceReconnect: true,
      });

      const add = conn.port.onMessage.addListener as unknown as MockInstance<
        (cb: (msg: unknown) => void) => void
      >;
      expect(add).toHaveBeenCalledTimes(1);
      const onMsg = add.mock.calls[0]?.[0] as (msg: unknown) => void;

      // Message fired: CONTENT_SIZE_RESULT
      const payload = { width: 1280, height: 720 };
      onMsg({ type: MSG_TYPE.CONTENT_SIZE_RESULT, payload });

      // CAPTURE_REQUESTED is dispatched as expected
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.CAPTURE_REQUESTED,
        contentSize: payload,
      });
    });
  });

  describe('execEffects', () => {
    it('returns early when needs-conn but ensureConnectionAlive fails', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = { ensureConnectionAlive: () => Promise<{ ok: false }> };
      const ensure = vi
        .spyOn(pc as unknown as Exposed, 'ensureConnectionAlive')
        .mockResolvedValue({ ok: false });

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.RENDER_CONTENT, items: [makeItem(1)] },
      ]);

      expect(ensure).toHaveBeenCalled();
    });

    it('returns early when contextChanged', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
      };
      const ensure = vi
        .spyOn(pc as unknown as Exposed, 'ensureConnectionAlive')
        .mockResolvedValue({ ok: true, contextChanged: true });

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.RENDER_CONTENT, items: [makeItem(1)] },
      ]);

      expect(ensure).toHaveBeenCalled();
    });

    it('delegates to content API (render/toggleSelect/clear/hover)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      const conn = makeConnStub();
      (pc as unknown as Record<string, unknown>)['conn'] = conn;
      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.RENDER_CONTENT, items: [makeItem(10)] },
        { kind: EffectType.TOGGLE_SELECT_ON_CONTENT, enabled: true },
        { kind: EffectType.CLEAR_CONTENT },
        { kind: EffectType.HOVER, id: 42 },
      ]);

      expect(conn.api.render).toHaveBeenCalledWith([makeItem(10)]);
      expect(conn.api.toggleSelect).toHaveBeenCalledWith(true);
      expect(conn.api.clear).toHaveBeenCalled();
      expect(conn.api.hover).toHaveBeenCalledWith(42);
    });

    it('CLEAR_STATE writes fresh state (nextId=1)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      (pc as unknown as { model: Record<string, unknown> }).model = {
        pageKey: 'key://local',
        items: [makeItem(1), makeItem(2), makeItem(3)],
        nextId: 9,
        nextLabel: 9,
        defaultSize: 20,
        defaultColor: 'Green',
        defaultShape: 'square',
        defaultGroup: 'right-top-outside',
        defaultPosition: '',
      };
      type Exposed = { ensureConnectionAlive: () => Promise<unknown> };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      await callPrivate<Promise<void>>(pc, 'execEffects', [{ kind: EffectType.CLEAR_STATE }]);

      expect(ensure).not.toHaveBeenCalled();
      expect(setSpy).toHaveBeenCalledWith('key://local', {
        items: [makeItem(1), makeItem(2), makeItem(3)],
        nextId: 1,
        defaultSize: 20,
        defaultColor: 'Green',
        defaultShape: 'square',
        defaultGroup: 'right-top-outside',
        defaultPosition: '',
      });
    });

    it('PERSIST_STATE merges previous state and overrides items/nextLabel/default* (keeps nextId)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      (pc as unknown as { model: Record<string, unknown> }).model = {
        pageKey: 'key://persist',
        items: [makeItem(100, { color: 'Purple', shape: 'square' })],
        nextId: 99,
        nextLabel: 7,
        defaultSize: 18,
        defaultColor: 'Purple',
        defaultShape: 'square',
        defaultGroup: 'right-top-outside',
        defaultPosition: '',
      };
      const getSpy = vi.spyOn(screenStateTable, 'get').mockResolvedValue({
        items: [makeItem(1), makeItem(2)],
        nextId: 5,
        defaultSize: 12,
        defaultColor: 'Red',
        defaultShape: 'circle',
        defaultPosition: 'left-top-inside',
        defaultGroup: '',
      });
      const setSpy = vi
        .spyOn(screenStateTable, 'set')
        .mockResolvedValue(undefined as unknown as void);

      await callPrivate<Promise<void>>(pc, 'execEffects', [{ kind: EffectType.PERSIST_STATE }]);

      expect(getSpy).toHaveBeenCalledWith('key://persist');
      expect(setSpy).toHaveBeenCalledWith(
        'key://persist',
        expect.objectContaining({
          items: [makeItem(100, { color: 'Purple', shape: 'square' })],
          nextId: 5,
          defaultSize: 18,
          defaultColor: 'Purple',
          defaultShape: 'square',
          defaultGroup: 'right-top-outside',
          defaultPosition: '',
        }),
      );
    });

    it('CAPTURE success and failure dispatch', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      type Exposed = { dispatch: (a: unknown) => void };
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      vi.mocked(capture).mockResolvedValueOnce(undefined);
      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.CAPTURE, payload: { foo: 'bar' } },
      ]);
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.CAPTURE_SUCCEEDED });

      vi.mocked(capture).mockRejectedValueOnce(new Error('boom'));
      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.CAPTURE, payload: {} },
      ]);
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: ActionType.CAPTURE_FAILED }),
      );
    });

    it('NOTIFY_ERROR logs to console.error', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      const spyErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.NOTIFY_ERROR, error: 'oops' },
      ]);

      expect(spyErr).toHaveBeenCalledWith('oops');
    });

    it('delegates MEASURE_CONTENT_SIZE to content API (api.measureSize)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      const conn = makeConnStub();
      (pc as unknown as Record<string, unknown>)['conn'] = conn;

      type Exposed = {
        ensureConnectionAlive: () => Promise<{ ok: true; contextChanged: boolean }>;
      };
      vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive').mockResolvedValue({
        ok: true,
        contextChanged: false,
      });

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.MEASURE_CONTENT_SIZE },
      ]);

      expect(conn.api.measureSize).toHaveBeenCalledTimes(1);
    });

    it('SET_THEME: reads theme from themeTable and dispatches SET_THEME', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      type Exposed = {
        ensureConnectionAlive: () => Promise<unknown>;
        dispatch: (a: unknown) => void;
      };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const getSpy = vi.spyOn(themeTable, 'get').mockResolvedValue('dark' as never);

      await callPrivate<Promise<void>>(pc, 'execEffects', [{ kind: EffectType.SET_THEME }]);

      expect(ensure).not.toHaveBeenCalled();
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.SET_THEME, theme: 'dark' });
    });

    it('UPDATE_THEME: writes theme to themeTable (no dispatch)', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      type Exposed = {
        ensureConnectionAlive: () => Promise<unknown>;
        dispatch: (a: unknown) => void;
      };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const setSpy = vi.spyOn(themeTable, 'set').mockResolvedValue(undefined as unknown as void);

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.UPDATE_THEME, theme: 'light' as never },
      ]);

      expect(ensure).not.toHaveBeenCalled();
      expect(setSpy).toHaveBeenCalledWith('light');
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('READ_SCREEN_STATE_STORE: loads all keys and dispatches STORE_RELOAD_SUCCEEDED', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      type Exposed = {
        ensureConnectionAlive: () => Promise<unknown>;
        dispatch: (a: unknown) => void;
      };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const readAllSpy = vi.spyOn(screenStateTable, 'readAll').mockResolvedValue({
        'key://alpha': { items: [] },
        'key://beta': { items: [] },
        'key://gamma': { items: [] },
      } as never);

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.READ_SCREEN_STATE_STORE },
      ]);

      // No connection needed for store reading
      expect(ensure).not.toHaveBeenCalled();
      // Read all was called and keys were propagated via STORE_RELOAD_SUCCEEDED
      expect(readAllSpy).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.STORE_RELOAD_SUCCEEDED,
        pageKeys: expect.arrayContaining(['key://alpha', 'key://beta', 'key://gamma']),
      });
    });

    it('REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY: removes entry, reloads keys, and restores current state', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      // Current model.pageKey to be restored after deletion
      (pc as unknown as { model: { pageKey: string } }).model.pageKey = 'key://current';

      type Exposed = {
        ensureConnectionAlive: () => Promise<unknown>;
        dispatch: (a: unknown) => void;
      };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const removeSpy = vi.spyOn(screenStateTable, 'remove').mockResolvedValue(undefined as never);

      // After removal, the remaining keys returned by readAll
      const readAllSpy = vi.spyOn(screenStateTable, 'readAll').mockResolvedValue({
        'key://alpha': { items: [] },
        'key://current': { items: [] },
      } as never);

      // The state to restore for the current page
      const restored = {
        items: [makeItem(1), makeItem(2)],
        defaultSize: 16,
        defaultColor: 'Blue' as const,
        defaultShape: 'square' as const,
        defaultPosition: 'left-top-outside' as const,
        defaultGroup: UNGROUPED_VALUE,
      };
      const getSpy = vi.spyOn(screenStateTable, 'get').mockResolvedValue(restored as never);

      // Execute the effect under test
      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.REMOVE_SCREEN_STATE_STORE_BY_PAGE_KEY, pageKey: 'key://to-remove' },
      ]);

      // No connection required
      expect(ensure).not.toHaveBeenCalled();
      // Remove → readAll → get(current) were called
      expect(removeSpy).toHaveBeenCalledWith('key://to-remove');
      expect(readAllSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith('key://current');

      // First, the list refresh
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.STORE_RELOAD_SUCCEEDED,
        pageKeys: expect.arrayContaining(['key://alpha', 'key://current']),
      });

      // Then, the current page state restore
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.RESTORE_STATE,
        state: expect.objectContaining({
          items: restored.items,
          defaultSize: restored.defaultSize,
          defaultColor: restored.defaultColor,
          defaultShape: restored.defaultShape,
          defaultPosition: restored.defaultPosition,
          defaultGroup: restored.defaultGroup,
        }),
      });
    });

    it('EXPORT_SCREEN_STATE_BY_PAGE_KEY: reads state and calls exportScreenState', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      type Exposed = {
        ensureConnectionAlive: () => Promise<unknown>;
        dispatch: (a: unknown) => void;
      };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      const state = {
        items: [],
        nextId: 1,
        defaultSize: 12,
        defaultColor: 'Red' as const,
        defaultShape: 'circle' as const,
        defaultPosition: 'left-top-outside' as const,
        defaultGroup: UNGROUPED_VALUE,
      };
      const getSpy = vi.spyOn(screenStateTable, 'get').mockResolvedValue(state as never);
      vi.mocked(exportScreenState).mockResolvedValueOnce(123 as never);

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.EXPORT_SCREEN_STATE_BY_PAGE_KEY, pageKey: 'key://export-me' },
      ]);

      // No connection required
      expect(ensure).not.toHaveBeenCalled();
      // State is retrieved and passed to exporter
      expect(getSpy).toHaveBeenCalledWith('key://export-me');
      expect(exportScreenState).toHaveBeenCalledWith(state, 'key://export-me');
      // Success path does not dispatch anything
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('EXPORT_SCREEN_STATE_BY_PAGE_KEY: dispatches EXPORT_FAILED on error', async () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);

      type Exposed = { dispatch: (a: unknown) => void };
      const dispatch = vi
        .spyOn(pc as unknown as Exposed, 'dispatch')
        .mockImplementation(() => undefined);

      // screenStateTable.get succeeds, but exporter throws
      vi.spyOn(screenStateTable, 'get').mockResolvedValue({
        items: [],
        nextId: 1,
        defaultSize: 12,
        defaultColor: 'Red' as const,
        defaultShape: 'circle' as const,
        defaultPosition: 'left-top-outside' as const,
        defaultGroup: UNGROUPED_VALUE,
      } as never);

      const err = new Error('export failed');
      vi.mocked(exportScreenState).mockRejectedValueOnce(err);

      await callPrivate<Promise<void>>(pc, 'execEffects', [
        { kind: EffectType.EXPORT_SCREEN_STATE_BY_PAGE_KEY, pageKey: 'key://export-error' },
      ]);

      // Error path dispatches EXPORT_FAILED
      expect(dispatch).toHaveBeenCalledWith({
        type: ActionType.EXPORT_FAILED,
        error: err,
      });
    });
  });

  describe('dispatch', () => {
    it('uses update → render → execEffects chain', () => {
      const view = new ViewStub();
      const pc = new PanelController(view as unknown as never);
      const effects = [{ kind: EffectType.NOTIFY_ERROR, error: 'x' }];
      const updateMock = update as unknown as ReturnType<typeof vi.fn>;
      updateMock.mockReturnValueOnce({
        model: {
          pageKey: 'next',
          items: [makeItem(1)],
          nextId: 2,
          nextLabel: 2,
          defaultSize: 12,
          defaultColor: 'Red',
          defaultShape: 'circle',
        },
        effects,
      });
      type Exposed = { execEffects: (fx: unknown[]) => Promise<void> };
      const exec = vi.spyOn(pc as unknown as Exposed, 'execEffects').mockResolvedValue(undefined);

      callPrivate<void>(pc, 'dispatch', { type: ActionType.TOGGLE_SELECT });

      expect(view.render).toHaveBeenCalledWith(
        expect.objectContaining({ pageKey: 'next', items: [makeItem(1)] }),
      );
      expect(exec).toHaveBeenCalledWith(effects);
    });
  });
});
