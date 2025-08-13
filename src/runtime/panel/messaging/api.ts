
import { MSG_TYPE, PanelToContent, RpcRequest } from '@common/messages';
import { ScreenItem } from '@common/types';

import { PortRpc } from './port_rpc';

export class PanelApi {
  constructor(private rpc: PortRpc) {}

  private send(body: PanelToContent) {
    const req: RpcRequest = {
      id: crypto.randomUUID(),
      expectReply: false,
      ...body
    };
    return this.rpc.send(req);
  }

  render(items: ScreenItem[]) {
    return this.send({ type: MSG_TYPE.RENDER, payload: { items } });
  }

  toggleSelect(enabled: boolean) {
    return this.send({ type: MSG_TYPE.TOGGLE_SELECT, payload: { enabled } });
  }

  clear() {
    return this.send({ type: MSG_TYPE.CLEAR });
  }

  ping() {
    const req: RpcRequest = {
      id: crypto.randomUUID(),
      expectReply: true,
      type: MSG_TYPE.PING
    };
    return this.rpc.send(req, 5000);
  }
}
