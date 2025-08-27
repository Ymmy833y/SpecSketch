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

export type ScreenItem = {
  id: number;
  label: number;
  anchor: Anchor;
  size: number;
  color: ItemColor;
  shape: ItemShape;
  group?: string;
};

export type ScreenState = {
  items: ScreenItem[];
  nextId: number;
  nextLabel: number;
  defaultSize: number;
  defaultColor: ItemColor;
  defaultShape: ItemShape;
};
