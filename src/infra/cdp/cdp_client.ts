export const CDP_VERSION = '1.3' as const;

export type Debuggee = chrome.debugger.Debuggee;

/**
 * Wraps `chrome.runtime.lastError` into a standard `Error` instance.
 *
 * @returns An `Error` if a last error exists; otherwise `null`.
 */
function lastError(): Error | null {
  const err = chrome.runtime.lastError;
  return err ? new Error(err.message || String(err)) : null;
}

/** Tracks tabIds that this extension currently owns (attached by itself). */
const OWNED = new Set<number>();

/** Clears ownership on detach (covers external causes like opening/closing DevTools). */
chrome.debugger.onDetach.addListener((debuggee) => {
  const id = debuggee.tabId;
  if (typeof id === 'number') OWNED.delete(id);
});

/**
 * Detaches the Chrome Debugger (CDP) from the given target.
 *
 * @param target - The debuggee to detach from.
 * @returns A promise that resolves once detachment completes.
 */
async function detach(target: Debuggee): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
}

/**
 * Safely attaches to the target. If a previous session owned by this extension
 * is already attached, it reuses it instead of failing.
 *
 * @param target - The debuggee to attach to (e.g., `{ tabId }`).
 * @returns A promise that resolves to `true` when this call performed a new attach,
 *          or `false` when an existing owned session is reused.
 * @throws If another client (DevTools/another extension) is attached, or on other attach errors.
 */
export async function attachOwned(target: Debuggee): Promise<boolean> {
  const tabId = target.tabId ?? null;
  return await new Promise<boolean>((resolve, reject) => {
    chrome.debugger.attach(target, CDP_VERSION, () => {
      const err = chrome.runtime.lastError;
      if (!err) {
        if (tabId != null) OWNED.add(tabId);
        resolve(true); // newly attached by this call
        return;
      }
      const msg = err.message || '';
      if (msg.includes('Another debugger is already attached')) {
        // Already attached: reuse only if owned by this extension.
        if (tabId != null && OWNED.has(tabId)) {
          resolve(false); // reuse existing owned session
        } else {
          reject(new Error('Debugger is already attached by another client (DevTools/extension).'));
        }
      } else {
        reject(new Error(msg));
      }
    });
  });
}

/**
 * Safely detaches only when the current extension owns the session.
 * No-ops if the target is not owned.
 *
 * @param target - The debuggee to detach from.
 * @returns A promise that resolves after detaching (or immediately if not owned).
 */
export async function detachOwned(target: Debuggee): Promise<void> {
  const tabId = target.tabId ?? null;
  if (tabId == null) return;
  if (!OWNED.has(tabId)) return; // not owned by this extension

  await detach(target);
  OWNED.delete(tabId);
}

/**
 * Sends a CDP command to the attached target.
 *
 * @typeParam T - Expected result type of the command.
 * @param target - The debuggee to which the command is sent.
 * @param method - CDP method name (e.g., `'Page.captureScreenshot'`).
 * @param params - Optional parameters object for the command.
 * @returns A promise that resolves with the command result or rejects if an error occurs.
 */
export async function send<T = unknown>(
  target: Debuggee,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params ?? {}, (result) => {
      const err = lastError();
      if (err) {
        reject(err);
      } else {
        resolve((result ?? {}) as T);
      }
    });
  });
}
