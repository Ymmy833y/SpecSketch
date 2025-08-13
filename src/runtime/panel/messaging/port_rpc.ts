import { isResponse, RpcRequest, RpcResponse } from '@common/messages';

export class PortRpc {
  private port: chrome.runtime.Port;
  private pending = new Map<string, (res?: RpcResponse) => void>();

  constructor(port: chrome.runtime.Port) {
    this.port = port;
    this.port.onMessage.addListener((msg) => {
      if (isResponse(msg)) {
        this.pending.get(msg.id)?.(msg);
        this.pending.delete(msg.id);
      }
    });
    this.port.onDisconnect.addListener(() => {
      // Treat pending status as failure when a disconnection occurs.
      for (const [, resolve] of this.pending) resolve({ id: '', ok: false, error: 'disconnected' });
      this.pending.clear();
    });
  }

  send<T extends RpcRequest>(req: T, timeoutMs = 5000): Promise<RpcResponse | undefined> {
    return new Promise((resolve) => {
      if (req.expectReply) {
        const timer = setTimeout(() => {
          this.pending.delete(req.id);
          resolve(undefined);
        }, timeoutMs);
        this.pending.set(req.id, (res) => {
          clearTimeout(timer);
          resolve(res);
        });
      }
      this.port.postMessage(req);
      if (!req.expectReply) resolve(undefined);
    });
  }
}
