export type IconDef = Readonly<{
  d: string;
  viewBox?: string;
}>;

export const ICONS = {
  caretDown: {
    d: 'M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.062L10.53 12.53a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 01.02-1.06z',
    viewBox: '0 0 20 20',
  },
  caretDownFill: {
    d: 'M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z',
    viewBox: '0 0 16 16',
  },
  caretRight: {
    d: 'M7.293 14.707a1 1 0 01-1.414-1.414L10.172 9 5.879 4.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5z',
    viewBox: '0 0 20 20',
  },
  caretRightFill: {
    d: 'm12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z',
    viewBox: '0 0 16 16',
  },
  warn: {
    d: 'M9.049 2.927a1.5 1.5 0 012.902 0l6.41 11.94A1.5 1.5 0 0117.01 17H2.99a1.5 1.5 0 01-1.351-2.133l6.41-11.94zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 001-1V7a1 1 0 10-2 0v3a1 1 0 001 1z',
    viewBox: '0 0 20 20',
  },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function getIcon(name: IconName): Required<IconDef> {
  const { d, viewBox = '0 0 20 20' } = ICONS[name];
  return { d, viewBox };
}
