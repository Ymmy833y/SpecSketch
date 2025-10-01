import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Utilities ---------------------------------------------------------------

function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: state,
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

// --- Mocks (declared per-test; installed before importing SUT) --------------

class PanelViewStub {
  static ctor = vi.fn((_: Document) => {});
  static instances: PanelViewStub[] = [];

  constructor(doc: Document) {
    PanelViewStub.ctor(doc);
    PanelViewStub.instances.push(this);
  }
}

type StartMode = 'resolve' | 'reject';
let startMode: StartMode = 'resolve';

class PanelControllerStub {
  static ctor = vi.fn((view: unknown) => {
    void view;
  });
  static instances: PanelControllerStub[] = [];

  public start = vi.fn(async () => {
    if (startMode === 'reject') {
      throw new Error('boom');
    }
  });

  constructor(view: unknown) {
    PanelControllerStub.ctor(view);
    PanelControllerStub.instances.push(this);
  }
}

// --- Test suite --------------------------------------------------------------

describe('panel/app/index', () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    PanelViewStub.ctor.mockClear();
    PanelViewStub.instances.length = 0;
    PanelControllerStub.ctor.mockClear();
    PanelControllerStub.instances.length = 0;
    startMode = 'resolve';

    addEventSpy = vi.spyOn(document, 'addEventListener');

    consoleErrorSpy = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    addEventSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('starts immediately when document is interactive (no DOMContentLoaded listener)', async () => {
    // Arrange
    setReadyState('interactive');

    vi.mock('@panel/controller/panel_controller', () => ({
      PanelController: PanelControllerStub,
    }));
    vi.mock('@panel/view/panel_view', () => ({
      PanelView: PanelViewStub,
    }));
    vi.mock('../view/panel_view', () => ({
      PanelView: PanelViewStub,
    }));

    // Act
    await import('@panel/app/index');
    await flushMicrotasks();

    // Assert
    expect(PanelViewStub.ctor).toHaveBeenCalledTimes(1);
    const passedDoc = PanelViewStub.ctor.mock.calls[0]?.[0] as Document | undefined;
    expect(passedDoc).toBe(document);

    expect(PanelControllerStub.ctor).toHaveBeenCalledTimes(1);
    const viewPassedToController = PanelControllerStub.ctor.mock.calls[0]?.[0];
    expect(viewPassedToController).toBe(PanelViewStub.instances[0]);

    const ctrl = PanelControllerStub.instances[0];
    expect(ctrl!.start).toHaveBeenCalledTimes(1);

    // No DOMContentLoaded listeners are registered
    const domLoadedCalls = addEventSpy.mock.calls.filter((c) => c[0] === 'DOMContentLoaded');
    expect(domLoadedCalls.length).toBe(0);
  }, 5000);

  it('defers start until DOMContentLoaded (once: true prevents duplicate start)', async () => {
    // Arrange
    setReadyState('loading');

    vi.mock('@panel/controller/panel_controller', () => ({
      PanelController: PanelControllerStub,
    }));
    vi.mock('@panel/view/panel_view', () => ({
      PanelView: PanelViewStub,
    }));
    vi.mock('../view/panel_view', () => ({
      PanelView: PanelViewStub,
    }));

    // Act
    await import('@panel/app/index');
    await flushMicrotasks();

    expect(PanelControllerStub.instances.length).toBe(0);
    expect(PanelViewStub.instances.length).toBe(0);

    // Ensure DOMContentLoaded is registered with once: true
    expect(addEventSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function), {
      once: true,
    });

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushMicrotasks();

    expect(PanelControllerStub.instances.length).toBe(1);
    const ctrl1 = PanelControllerStub.instances[0];
    expect(ctrl1!.start).toHaveBeenCalledTimes(1);

    // Even if you throw it a second time, it will not restart with once: true
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushMicrotasks();

    expect(PanelControllerStub.instances.length).toBe(1);
    expect(ctrl1!.start).toHaveBeenCalledTimes(1);
  }, 5000);

  it('logs error when start() rejects', async () => {
    // Arrange
    setReadyState('complete');
    startMode = 'reject';

    consoleErrorSpy.mockImplementation(() => undefined);

    vi.mock('@panel/controller/panel_controller', () => ({
      PanelController: PanelControllerStub,
    }));
    vi.mock('@panel/view/panel_view', () => ({
      PanelView: PanelViewStub,
    }));
    vi.mock('../view/panel_view', () => ({
      PanelView: PanelViewStub,
    }));

    // Act
    await import('@panel/app/index');
    await flushMicrotasks();

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const args = consoleErrorSpy.mock.calls[0] ?? [];
    expect(String(args[0])).toContain('Panel bootstrap failed:');
    const err = args[1];
    expect(err instanceof Error).toBe(true);
    expect((err as Error).message).toBe('boom');

    // Even if it fails, it will still be generated (failed within start)
    expect(PanelControllerStub.instances.length).toBe(1);
    expect(PanelControllerStub.instances[0]!.start).toHaveBeenCalledTimes(1);
  }, 5000);
});
