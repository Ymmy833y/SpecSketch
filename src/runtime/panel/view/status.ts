import i18n from '@common/i18n';

export const STATUS = {
  RESTRICTED:   'RESTRICTED',
  CONNECTING:   'CONNECTING',
  CONNECTED:    'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type StatusKey = typeof STATUS[keyof typeof STATUS];

const STATUS_MSG_KEY: Record<StatusKey, string> = {
  RESTRICTED:   'status_restricted',
  CONNECTING:   'status_connecting',
  CONNECTED:    'status_connected',
  DISCONNECTED: 'status_disconnected',
};

export function getStatusMessage(key: StatusKey): string {
  const msgKey = STATUS_MSG_KEY[key];
  return i18n.get(msgKey) || msgKey;
}
