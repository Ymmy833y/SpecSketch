import i18n from '@common/i18n';

export const STATUS = {
  RESTRICTED: 'RESTRICTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type StatusKey = (typeof STATUS)[keyof typeof STATUS];

const STATUS_MSG_KEY: Record<StatusKey, string> = {
  RESTRICTED: 'status_restricted',
  CONNECTING: 'status_connecting',
  CONNECTED: 'status_connected',
  DISCONNECTED: 'status_disconnected',
};

export const STATUS_LABEL_STYLE: Record<StatusKey, { body: string[]; dot: string[] }> = {
  RESTRICTED: {
    body: [
      'bg-amber-50',
      'border-amber-200',
      'text-amber-700',
      'dark:bg-amber-950',
      'dark:border-amber-900/50',
      'dark:text-amber-300',
    ],
    dot: ['bg-amber-500'],
  },
  CONNECTING: {
    body: [
      'bg-sky-50',
      'border-sky-200',
      'text-sky-700',
      'dark:bg-sky-950',
      'dark:border-sky-900/50',
      'dark:text-sky-300',
    ],
    dot: ['bg-sky-500'],
  },
  CONNECTED: {
    body: [
      'bg-emerald-50',
      'border-emerald-200',
      'text-emerald-700',
      'dark:bg-emerald-950',
      'dark:border-emerald-900/50',
      'dark:text-emerald-300',
    ],
    dot: ['bg-emerald-500'],
  },
  DISCONNECTED: {
    body: [
      'bg-rose-50',
      'border-rose-200',
      'text-rose-700',
      'dark:bg-rose-950',
      'dark:border-rose-900/50',
      'dark:text-rose-300',
    ],
    dot: ['bg-rose-500'],
  },
};

export function getStatusMessage(key: StatusKey): string {
  const msgKey = STATUS_MSG_KEY[key];
  return i18n.get(msgKey) || msgKey;
}
