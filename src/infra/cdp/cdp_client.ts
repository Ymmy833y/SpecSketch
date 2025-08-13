export const CDP_VERSION = '1.3' as const;

export type Debuggee = chrome.debugger.Debuggee;

/**
 * Wraps `chrome.runtime.lastError` into a standard `Error` instance.
 *
 * @returns An `Error` when a lastError exists; otherwise `null`.
 */
function lastError(): Error | null {
  const err = chrome.runtime.lastError;
  return err ? new Error(err.message || String(err)) : null;
}

/**
 * Attaches the Chrome Debugger (CDP) to the given target.
 *
 * @param target - The debuggee (e.g., `{ tabId }`) to attach to.
 * @returns A promise that resolves when the debugger is attached, or rejects on error.
 */
export async function attach(target: Debuggee): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.debugger.attach(target, CDP_VERSION, () => {
      const err = lastError();
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Detaches the Chrome Debugger (CDP) from the given target.
 *
 * @param target - The debuggee to detach from.
 * @returns A promise that resolves once detachment completes.
 */
export async function detach(target: Debuggee): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
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
  params?: Record<string, unknown>
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
