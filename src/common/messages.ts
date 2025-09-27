import type { Anchor, ContentSize, ScreenItem } from './types';

const P2C = {
  PING: 'PING',
  TOGGLE_SELECT: 'TOGGLE_SELECT',
  RENDER: 'RENDER',
  CLEAR: 'CLEAR',
  HOVER: 'HOVER',
  MEASURE_SIZE: 'MEASURE_SIZE',
} as const;

const C2P = {
  SELECTED: 'SELECTED',
  MISSING_IDS: 'MISSING_IDS',
  CONTENT_SIZE_RESULT: 'CONTENT_SIZE_RESULT',
} as const;

const B2P = {
  ACTIVE_TAB_CHANGED: 'ACTIVE_TAB_CHANGED',
} as const;

export const MSG_TYPE = { ...P2C, ...C2P, ...B2P } as const;

export type P2CType = (typeof P2C)[keyof typeof P2C];
export type C2PType = (typeof C2P)[keyof typeof C2P];
export type B2PType = (typeof B2P)[keyof typeof B2P];
export type MsgType = (typeof MSG_TYPE)[keyof typeof MSG_TYPE];

export type PanelToContent =
  | { type: typeof P2C.PING; id?: string }
  | { type: typeof P2C.TOGGLE_SELECT; payload: { enabled: boolean } }
  | { type: typeof P2C.RENDER; payload: { items: ScreenItem[] } }
  | { type: typeof P2C.CLEAR }
  | { type: typeof P2C.HOVER; payload: { id: number | null } }
  | { type: typeof P2C.MEASURE_SIZE };

export type ContentToPanel =
  | { type: typeof C2P.SELECTED; payload: { anchors: Anchor[] } }
  | { type: typeof C2P.MISSING_IDS; payload: { missingIds: number[] } }
  | { type: typeof C2P.CONTENT_SIZE_RESULT; payload: ContentSize };

export type BackgroundToPanel = {
  type: typeof B2P.ACTIVE_TAB_CHANGED;
  payload: { tabId: number; windowId: number; url?: string; pageKey?: string };
};

export type RpcRequest = {
  id: string;
  expectReply?: boolean;
} & (PanelToContent | ContentToPanel);

export type RpcResponse =
  | { id: string; ok: true; data?: unknown }
  | { id: string; ok: false; error: string };

export function isResponse(msg: unknown): msg is RpcResponse {
  return typeof msg === 'object' && msg !== null && 'id' in msg && 'ok' in msg;
}
