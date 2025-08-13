export type Anchor = {
  kind: 'css';
  value: string;
  version: 1;
};

export type ScreenItem = {
  id: number;
  label: number;
  anchor: Anchor;
  meta?: { note?: string; color?: string };
};

export type ScreenState = {
  items: ScreenItem[];
  nextId: number;
  nextLabel: number;
};
