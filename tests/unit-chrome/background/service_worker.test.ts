import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Module mock (declare BEFORE importing SUT) ----
vi.mock('@infra/chrome/tabs', () => ({
  registerActiveTabBroadcast: vi.fn(),
}));

describe('background/service_worker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('registers onInstalled listener on module load', async () => {
    const addSpy = vi.spyOn(chrome.runtime.onInstalled, 'addListener');
    await import('@background/service_worker');
    expect(addSpy).toHaveBeenCalledTimes(1);
  }, 5000);

  it('does not call setPanelBehavior before event', async () => {
    const setSpy = vi.spyOn(chrome.sidePanel, 'setPanelBehavior');
    await import('@background/service_worker');
    expect(setSpy).not.toHaveBeenCalled();
  }, 5000);

  it('calls sidePanel.setPanelBehavior when onInstalled fires', async () => {
    const addSpy = vi.spyOn(chrome.runtime.onInstalled, 'addListener');
    const setSpy = vi.spyOn(chrome.sidePanel, 'setPanelBehavior');

    await import('@background/service_worker');
    expect(addSpy).toHaveBeenCalledTimes(1);

    const firstCall = addSpy.mock.calls[0];
    expect(firstCall).toBeDefined();

    const listener = firstCall![0] as () => Promise<void>;
    await listener();

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  }, 5000);

  it('invokes registerActiveTabBroadcast on module load', async () => {
    const tabsMod = await import('@infra/chrome/tabs');
    await import('@background/service_worker');
    expect(tabsMod.registerActiveTabBroadcast).toHaveBeenCalledTimes(1);
  }, 5000);
});
