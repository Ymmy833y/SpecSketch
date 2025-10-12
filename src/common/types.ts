export type Anchor = {
  kind: 'css';
  value: string;
  version: 1;
};

export type ItemColor =
  | 'Gray'
  | 'Red'
  | 'Yellow'
  | 'Green'
  | 'Blue'
  | 'Lime'
  | 'Purple'
  | 'Pink'
  | 'Orange'
  | 'Cyan';

const ITEM_COLORS = [
  'Gray',
  'Red',
  'Yellow',
  'Green',
  'Blue',
  'Lime',
  'Purple',
  'Pink',
  'Orange',
  'Cyan',
] as const;

export function isItemColor(v: unknown): v is ItemColor {
  return typeof v === 'string' && (ITEM_COLORS as readonly string[]).includes(v);
}

export type ItemShape = 'circle' | 'square';

const ITEM_SHAPE = ['circle', 'square'] as const;

export function isItemShape(v: unknown): v is ItemShape {
  return typeof v === 'string' && (ITEM_SHAPE as readonly string[]).includes(v);
}

export type ItemPosition =
  | 'right-top-outside'
  | 'right-top-inside'
  | 'right-outside'
  | 'right-inside'
  | 'right-bottom-outside'
  | 'right-bottom-inside'
  | 'top-outside'
  | 'top-inside'
  | 'center'
  | 'bottom-outside'
  | 'bottom-inside'
  | 'left-top-outside'
  | 'left-top-inside'
  | 'left-outside'
  | 'left-inside'
  | 'left-bottom-outside'
  | 'left-bottom-inside';

export const ITEM_POSITION_VALUES: ItemPosition[] = [
  'right-top-outside',
  'right-top-inside',
  'right-outside',
  'right-inside',
  'right-bottom-outside',
  'right-bottom-inside',
  'top-outside',
  'top-inside',
  'center',
  'bottom-outside',
  'bottom-inside',
  'left-top-outside',
  'left-top-inside',
  'left-outside',
  'left-inside',
  'left-bottom-outside',
  'left-bottom-inside',
];

export function isItemPosition(v: unknown): v is ItemPosition {
  return typeof v === 'string' && (ITEM_POSITION_VALUES as readonly string[]).includes(v);
}

export type Ungrouped = '__ungrouped__';
export const UNGROUPED: Ungrouped = '__ungrouped__' as const;
export const UNGROUPED_VALUE = '' as const;
export type ItemGroup = Ungrouped | string;

export type LabelFormat = 'Numbers' | 'UpperAlpha' | 'LowerAlpha' | 'None';

export const LABEL_FORMAT: LabelFormat[] = ['Numbers', 'UpperAlpha', 'LowerAlpha', 'None'];

export function isLabelFormat(v: unknown): v is LabelFormat {
  return typeof v === 'string' && (LABEL_FORMAT as readonly string[]).includes(v);
}

export type ScreenItem = {
  id: number;
  label: number;
  anchor: Anchor;
  size: number;
  color: ItemColor;
  shape: ItemShape;
  position: ItemPosition;
  group?: string;
  comment?: string;
  labelFormat?: LabelFormat;
};

export type ScreenState = {
  items: ScreenItem[];
  nextId: number;
  defaultSize: number;
  defaultColor: ItemColor;
  defaultShape: ItemShape;
  defaultLabelFormat: LabelFormat;
  defaultPosition: ItemPosition;
  defaultGroup: ItemGroup;
};

export type ContentSize = {
  width: number;
  height: number;
};

export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'device';

export type payload = {
  format: 'specsketch-export';
  kind: 'screen-state';
  version: number;
  exportedAt: string;
  pageKey: string;
  items: ScreenItem[];
};

/**
 * Narrowing guard for a minimal `ScreenItem`-like shape.
 * Checks only the fields required by this import path (anchor structure).
 */
export function isScreenItemLike(v: unknown): v is ScreenItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const anchor = o['anchor'] as unknown;
  if (!anchor || typeof anchor !== 'object') return false;
  const a = anchor as Record<string, unknown>;
  return (
    a['kind'] === 'css' &&
    typeof a['value'] === 'string' &&
    (typeof a['version'] === 'number' || a['version'] === 1)
  );
}

/**
 * Validates a parsed JSON value against the expected export payload contract.
 * Requires: `format === 'specsketch-export'`, `kind === 'screen-state'`,
 * `version: number`, `pageKey: string`, and `items: ScreenItem[]`-like.
 */
export function isValidPayload(v: unknown): v is payload {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o['format'] !== 'specsketch-export') return false;
  if (o['kind'] !== 'screen-state') return false;
  if (typeof o['version'] !== 'number') return false;
  if (typeof o['pageKey'] !== 'string') return false;
  if (!Array.isArray(o['items'])) return false;
  return (o['items'] as unknown[]).every(isScreenItemLike);
}

export type ToastMessage = {
  uuid: string;
  message: string;
  kind: 'success' | 'error';
};
