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
import { isRestricted, pageKey } from '@common/url';
import { getActiveTab } from '@infra/chrome/tabs';
import { update } from '@panel/app/update';
import { PanelController } from '@panel/controller/panel_controller';
import { connectToTab } from '@panel/messaging/connection';
import { capture } from '@panel/services/capture';
import { getState, setState } from '@panel/state/store';
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
  }> = {},
) => ({
  id,
  label: overrides.label ?? id,
  anchor: overrides.anchor ?? { kind: 'css', value: `#item-${id}`, version: 1 },
  size: overrides.size ?? 12,
  color: overrides.color ?? 'Red',
  shape: overrides.shape ?? 'circle',
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
    vi.mocked(getState).mockReset();
    vi.mocked(setState).mockReset();
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
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.CAPTURE_REQUESTED });
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
      vi.mocked(getState).mockResolvedValue({
        items: [makeItem(1), makeItem(2)],
        nextId: 5,
        nextLabel: 3,
        defaultSize: 10,
        defaultColor: 'Blue',
        defaultShape: 'square',
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
          nextLabel: 3,
          defaultShape: 'square',
        }),
      });
      expect(dispatch).toHaveBeenCalledWith({ type: ActionType.SET_STATUS, status: 'CONNECTED' });
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
      };
      type Exposed = { ensureConnectionAlive: () => Promise<unknown> };
      const ensure = vi.spyOn(pc as unknown as Exposed, 'ensureConnectionAlive');

      await callPrivate<Promise<void>>(pc, 'execEffects', [{ kind: EffectType.CLEAR_STATE }]);

      expect(ensure).not.toHaveBeenCalled();
      expect(setState).toHaveBeenCalledWith('key://local', {
        items: [makeItem(1), makeItem(2), makeItem(3)],
        nextId: 1,
        nextLabel: 9,
        defaultSize: 20,
        defaultColor: 'Green',
        defaultShape: 'square',
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
      };
      vi.mocked(getState).mockResolvedValue({
        items: [makeItem(1), makeItem(2)],
        nextId: 5,
        nextLabel: 1,
        defaultSize: 12,
        defaultColor: 'Red',
        defaultShape: 'circle',
      });

      await callPrivate<Promise<void>>(pc, 'execEffects', [{ kind: EffectType.PERSIST_STATE }]);

      expect(getState).toHaveBeenCalledWith('key://persist');
      expect(setState).toHaveBeenCalledWith(
        'key://persist',
        expect.objectContaining({
          items: [makeItem(100, { color: 'Purple', shape: 'square' })],
          nextId: 5,
          nextLabel: 7,
          defaultSize: 18,
          defaultColor: 'Purple',
          defaultShape: 'square',
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
