import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module mocks (declare BEFORE importing SUT) ----
vi.mock('@common/constants', () => ({
  isPanelContentPort: (p: chrome.runtime.Port) =>
    Boolean((p as { name?: string }).name?.startsWith('panel:')),
}));

vi.mock('@common/messages', () => ({
  MSG_TYPE: {
    PING: 'PING',
    TOGGLE_SELECT: 'TOGGLE_SELECT',
    RENDER: 'RENDER',
    CLEAR: 'CLEAR',
    HOVER: 'HOVER',
    SELECTED: 'SELECTED',
    MISSING_IDS: 'MISSING_IDS',
  },
}));

const mountOverlayMock = vi.fn(async () => undefined);
const clearOverlayMock = vi.fn(async () => undefined);
const renderItemsMock = vi.fn(async (_items: unknown) => undefined);
const highlightOverlayMock = vi.fn(async (_id: number | null) => undefined);
const getMissingIdsMock = vi.fn<() => number[]>();
vi.mock('@content/overlay', () => ({
  mountOverlay: mountOverlayMock,
  clearOverlay: clearOverlayMock,
  renderItems: renderItemsMock,
  highlightOverlay: highlightOverlayMock,
  getMissingIds: getMissingIdsMock,
}));

// --- Selector mock: capture pick callback in file-scope var ---
let lastPickCb: ((el: Element) => void) | null = null;
const setEnabledSpy = vi.fn((_: boolean) => undefined);
vi.mock('@content/selector', () => {
  class Selector {
    constructor(cb: (el: Element) => void) {
      lastPickCb = cb;
    }
    setEnabled(enabled: boolean) {
      setEnabledSpy(enabled);
    }
  }
  return { Selector };
});

vi.mock('@content/anchor', () => ({
  buildCssAnchor: (_el: Element) => 'CSS>>div:nth-of-type(1)',
}));

// ---- Helpers ----
function createPort(name: string): chrome.runtime.Port {
  return {
    name,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as chrome.runtime.Port;
}

async function importSutFresh() {
  return import('@content/main');
}

function getOnConnectHandler(): (p: chrome.runtime.Port) => unknown {
  const calls = vi.mocked(chrome.runtime.onConnect.addListener).mock.calls;
  if (calls.length === 0) throw new Error('no onConnect listener registered');
  return calls[calls.length - 1]![0] as (p: chrome.runtime.Port) => unknown;
}

function getOnMessageHandler(port: chrome.runtime.Port): (msg: unknown) => unknown {
  const calls = vi.mocked(port.onMessage.addListener).mock.calls;
  if (calls.length === 0) throw new Error('no onMessage listener registered');
  return calls[calls.length - 1]![0] as (msg: unknown) => unknown;
}

// ---- Tests ----
describe('content/main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mountOverlayMock.mockClear();
    clearOverlayMock.mockClear();
    renderItemsMock.mockClear();
    highlightOverlayMock.mockClear();

    getMissingIdsMock.mockReset();
    getMissingIdsMock.mockReturnValue([]);

    setEnabledSpy.mockClear();
    lastPickCb = null;
  });

  it('ignores a non-panel port', async () => {
    // Arrange — import SUT and prepare a non-panel port
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const nonPanel = createPort('content:tab-1');

    // Act — simulate connection from a non-panel port
    await onConnect(nonPanel);

    // Assert — no overlay mount and no message listener registration
    expect(mountOverlayMock).not.toHaveBeenCalled();
    expect(vi.mocked(nonPanel.onMessage.addListener)).not.toHaveBeenCalled();
  });

  it('mounts overlay when a panel port connects', async () => {
    // Arrange — import SUT and prepare a panel port
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');

    // Act — simulate connection from a panel port
    await onConnect(panel);

    // Assert — overlay mounted and message listener registered
    expect(mountOverlayMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(panel.onMessage.addListener)).toHaveBeenCalledTimes(1);
  });

  it('replies ok to PING', async () => {
    // Arrange — connected panel port and its onMessage handler
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    const onMsg = getOnMessageHandler(panel);
    const msg = { type: 'PING', id: 'm1' };

    // Act — send PING
    await onMsg(msg);

    // Assert — replies with ok:true and same id
    expect(vi.mocked(panel.postMessage)).toHaveBeenCalledWith({ id: 'm1', ok: true });
  });

  it('toggles selection via TOGGLE_SELECT', async () => {
    // Arrange — connected panel and onMessage handler
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    const onMsg = getOnMessageHandler(panel);

    // Act — enable then disable selection
    await onMsg({ type: 'TOGGLE_SELECT', payload: { enabled: true } });
    await onMsg({ type: 'TOGGLE_SELECT', payload: { enabled: false } });

    // Assert — setEnabled called with true then false
    expect(setEnabledSpy).toHaveBeenCalledWith(true);
    expect(setEnabledSpy).toHaveBeenCalledWith(false);
  });

  it('renders items then posts missing ids', async () => {
    // Arrange — connected panel, onMessage handler, and stub missing ids
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    getMissingIdsMock.mockReturnValue([1]);
    const onMsg = getOnMessageHandler(panel);
    // Although the actual value passed is ScreenItem[], it is simplified to contain only the IDs.
    const items = [{ id: 1 }, { id: 2 }];

    // Act — send RENDER(items)
    await onMsg({ type: 'RENDER', payload: { items } });

    // Assert — items rendered and MISSING_IDS posted
    expect(renderItemsMock).toHaveBeenCalledWith(items);
    expect(vi.mocked(panel.postMessage)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MISSING_IDS',
        payload: { missingIds: [1] },
      }),
    );
  });

  it('clears overlay on CLEAR', async () => {
    // Arrange — connected panel and onMessage handler
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    const onMsg = getOnMessageHandler(panel);

    // Act — send CLEAR
    await onMsg({ type: 'CLEAR' });

    // Assert — overlay cleared
    expect(clearOverlayMock).toHaveBeenCalledTimes(1);
  });

  it('highlights on HOVER', async () => {
    // Arrange — connected panel and onMessage handler
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    const onMsg = getOnMessageHandler(panel);

    // Act — send HOVER(id)
    await onMsg({ type: 'HOVER', payload: { id: 1 } });

    // Assert — highlightOverlay called with id
    expect(highlightOverlayMock).toHaveBeenCalledWith(1);
  });

  it('does cleanup on port disconnect', async () => {
    // Arrange — connected panel and captured onDisconnect handler
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    const calls = vi.mocked(panel.onDisconnect.addListener).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const onDisconnect = calls[calls.length - 1]![0] as () => unknown;

    // Act — fire disconnect
    await onDisconnect();

    // Assert — selection disabled and overlay cleared
    expect(setEnabledSpy).toHaveBeenCalledWith(false);
    expect(clearOverlayMock).toHaveBeenCalledTimes(1);
  });

  it('onPick posts SELECTED with built anchor', async () => {
    // Arrange — connected panel and ensure pick callback is captured
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);

    // Act — trigger pick callback
    lastPickCb?.({} as Element);

    // Assert — SELECTED posted with anchor from buildCssAnchor
    expect(vi.mocked(panel.postMessage)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SELECTED',
        payload: { anchors: ['CSS>>div:nth-of-type(1)'] },
      }),
    );
  });

  it('ignores message without type', async () => {
    // Arrange — connected panel and onMessage handler
    await importSutFresh();
    const onConnect = getOnConnectHandler();
    const panel = createPort('panel:tab-1');
    await onConnect(panel);
    const onMsg = getOnMessageHandler(panel);

    // Act — send an object without type
    await onMsg({});

    // Assert — no side effects triggered
    expect(renderItemsMock).not.toHaveBeenCalled();
    expect(clearOverlayMock).not.toHaveBeenCalled();
    expect(highlightOverlayMock).not.toHaveBeenCalled();
    expect(setEnabledSpy).not.toHaveBeenCalled();
  });
});
