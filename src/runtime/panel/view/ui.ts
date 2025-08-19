import i18n from '@common/i18n';
import { isItemColor, isItemShape, type ItemColor, type ScreenItem } from '@common/types';
import { CaptureArea, CaptureFormat } from '@panel/services/capture';
import { getStatusMessage, STATUS, STATUS_LABEL_STYLE, type StatusKey } from '@panel/view/status';

const statusEl = document.getElementById('status') as HTMLSpanElement;

const toggleIconEl = document.getElementById('toggle-select-icon') as HTMLSpanElement;
const toggleLabelEl = document.getElementById('toggle-select-label') as HTMLSpanElement;

const selectCountEl = document.getElementById('select-count') as HTMLSpanElement;
const selectEmptyEl = document.getElementById('select-empty') as HTMLDivElement;
const selectListEl = document.getElementById('select-list') as HTMLUListElement;

const captureOptionsPanel = document.getElementById('capture-options') as HTMLElement;
const jpegOnlyEls = document.querySelectorAll<HTMLElement>('.jpeg-only');
const jpegQualityRange = document.getElementById('opt-quality-range') as HTMLInputElement;
const jpegQualityNumber = document.getElementById('opt-quality-number') as HTMLInputElement;

const badgeColorLabelEl = document.getElementById('badge-color-label') as HTMLSpanElement;
const badgeColorDotEl = document.getElementById('badge-color-dot') as HTMLSpanElement;
const badgeShapeSelect = document.getElementById('badge-shape-select') as HTMLSelectElement;

const STATUS_BASE_BODY = [
  'inline-flex',
  'items-center',
  'gap-1',
  'rounded-full',
  'border',
  'px-2',
  'py-1',
  'text-xs',
  'transition-colors',
] as const;

const TOGGLE_ICON_BASE = ['inline-block', 'w-3', 'h-3', 'rounded-full'] as const;

const TOGGLE_ICON_ON = ['bg-emerald-500'] as const;
const TOGGLE_ICON_OFF = ['bg-slate-300'] as const;

const CAPTURE_OPTION_COLLAPSED = '▼';
const CAPTURE_OPTION_EXPANDED = '▲';

function disabledBtns(isDisabled: boolean) {
  const btns = document.querySelectorAll('button');
  btns.forEach((btn) => (btn.disabled = isDisabled));
}

/**
 * Updates the connection status indicator's style and text.
 *
 * @param key - Current status key
 */
export function updateStatusUI(key: StatusKey) {
  const style = STATUS_LABEL_STYLE[key];

  statusEl.className = '';
  statusEl.classList.add(...STATUS_BASE_BODY, ...style.body);

  const dot = document.createElement('span');
  dot.classList.add('h-1.5', 'w-1.5', 'rounded-full', ...style.dot);

  const text = document.createElement('span');
  text.textContent = getStatusMessage(key);

  statusEl.replaceChildren(dot, text);
  disabledBtns(key !== STATUS.CONNECTED);
}

/**
 * Updates the selection toggle's icon and label.
 *
 * @param enabled - True if selection is enabled
 */
export function updateToggleIconUI(enabled: boolean) {
  toggleIconEl.className = '';
  toggleIconEl.classList.add(...TOGGLE_ICON_BASE, ...(enabled ? TOGGLE_ICON_ON : TOGGLE_ICON_OFF));
  toggleLabelEl.textContent = i18n.get(enabled ? 'toggle_on' : 'toggle_off');
}

/**
 * Rebuilds the selection list UI. Shows an empty state when no items exist.
 *
 * @param items - Items to display
 */
export function renderList(items: ScreenItem[]) {
  const isEmpty = items.length === 0;
  selectCountEl.textContent = String(items.length);

  if (isEmpty) {
    selectEmptyEl.classList.remove('hidden');
    selectListEl.replaceChildren();
    return;
  }

  selectEmptyEl.classList.add('hidden');
  const frag = document.createDocumentFragment();
  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'group flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60';
    li.dataset.id = String(it.id);

    const badge = document.createElement('span');
    badge.className =
      'inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 text-xs font-semibold';
    badge.textContent = String(it.label);

    const main = document.createElement('div');
    main.className = 'min-w-0 flex-1';

    const line1 = document.createElement('div');
    line1.className = 'text-sm font-medium truncate';
    line1.textContent = it.anchor.value;
    main.append(line1);

    li.append(badge, main);
    frag.appendChild(li);
  }
  selectListEl.replaceChildren(frag);
}

// Open/close capture options
export function toggleCaptureOptionsUI(toggleBtn: HTMLButtonElement) {
  const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
  toggleBtn.setAttribute('aria-expanded', String(!expanded));
  toggleBtn.textContent = expanded ? CAPTURE_OPTION_COLLAPSED : CAPTURE_OPTION_EXPANDED;
  captureOptionsPanel.classList.toggle('hidden', expanded);
}

export function getSelectedCaptureFormat(): CaptureFormat {
  const val = document.querySelector<HTMLInputElement>(
    'input[name="capture-format"]:checked',
  )?.value;
  return val === 'jpeg' ? 'jpeg' : 'png'; // default: png
}

export function updateQualityVisibility(): void {
  const isJpeg = getSelectedCaptureFormat() === 'jpeg';
  jpegOnlyEls.forEach((el) => el.classList.toggle('hidden', !isJpeg));
  if (jpegQualityRange) jpegQualityRange.disabled = !isJpeg;
  if (jpegQualityNumber) jpegQualityNumber.disabled = !isJpeg;
}

export function getSelectedCaptureArea(): CaptureArea {
  const val = document.querySelector<HTMLInputElement>('input[name="capture-area"]:checked')?.value;
  return val === 'full' ? 'full' : 'viewport'; // default: full
}

// Synchronization of range and number (quality/scale)
export function bindSync(rangeEl: HTMLInputElement, numberEl: HTMLInputElement): void {
  const readNum = (s: string | null | undefined, fallback: number): number => {
    const v = s != null && s !== '' ? Number(s) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };

  const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

  rangeEl.addEventListener('input', () => {
    numberEl.value = rangeEl.value;
  });

  numberEl.addEventListener('input', () => {
    const min = readNum(numberEl.min || rangeEl.min, Number.NEGATIVE_INFINITY);
    const max = readNum(numberEl.max || rangeEl.max, Number.POSITIVE_INFINITY);
    const step = readNum(numberEl.step || rangeEl.step, 1);

    const raw = Number(numberEl.value);
    const clamped = clamp(Number.isFinite(raw) ? raw : 0, min, max);

    // step rounding (supports fractional steps such as 0.1)
    const rounded = Math.round(clamped / step) * step;

    // Reduce floating point errors (round to 6 decimal places)
    const fixed = Number(rounded.toFixed(6));

    numberEl.value = String(fixed);
    rangeEl.value = String(fixed);
  });
}

function getBadgeColorStyleName(color: ItemColor) {
  let colorName: string;
  switch (color) {
    case 'Gray':
      colorName = 'slate';
      break;
    default:
      colorName = color;
      break;
  }

  return `bg-${colorName.toLowerCase()}-500`;
}

export function updateBadgeColorUI(selectColor: string) {
  if (!isItemColor(selectColor)) {
    selectColor = 'Blue';
  }
  const color = selectColor as ItemColor;
  const buttons = document.querySelectorAll<HTMLButtonElement>('#badge-color-pop button');
  buttons.forEach((button) => {
    if (button.dataset.colorName === color) {
      button.setAttribute('aria-selected', 'true');
    } else {
      button.setAttribute('aria-selected', 'false');
    }
    badgeColorLabelEl.textContent = color;
    badgeColorDotEl.className = 'inline-block w-4 h-4 rounded-full';
    badgeColorDotEl.classList.add(getBadgeColorStyleName(color));
  });
}

export function getBadgeColor(def: ItemColor = 'Blue'): ItemColor {
  const raw = badgeColorLabelEl.textContent?.trim() ?? null;
  return isItemColor(raw) ? raw : def;
}

export function getBadgeShape() {
  const v = badgeShapeSelect.value ?? null;
  return isItemShape(v) ? v : 'circle';
}
