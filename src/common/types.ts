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

export function isItemColor(v: string | null): v is ItemColor {
  return v !== null && (ITEM_COLORS as readonly string[]).includes(v);
}

export type ItemShape = 'circle' | 'square';

const ITEM_SHAPE = ['circle', 'square'] as const;

export function isItemShape(v: string | null): v is ItemShape {
  return v !== null && (ITEM_SHAPE as readonly string[]).includes(v);
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
